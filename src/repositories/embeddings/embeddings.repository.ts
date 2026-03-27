import {
  EmbeddingEntry,
  SimilarityResult,
  BuscarRegistrosPorFechaYOrganismoPayload,
  BuscarRegistrosRequest,
  BuscarRegistrosResult,
  RegistroSCBA,
  ObtenerDocumentoSCBARequest,
  ObtenerDocumentoSCBAResult,
  DocumentoSCBA,
} from './types';
import { load } from 'cheerio';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const EMBEDDINGS_DIR = join(process.cwd(), 'data', 'embeddings');
const SCBA_BUSCAR_REGISTROS_URL =
  'https://sentencias.scba.gov.ar/RegistroElectronico/BuscarRegistrosPorFechaYOrganismo';
const SCBA_OBTENER_REGISTRO_URL =
  'https://sentencias.scba.gov.ar/RegistroElectronico/ObtenerRegistroVisualizar/';

const DEFAULT_SCBA_PAYLOAD: BuscarRegistrosPorFechaYOrganismoPayload = {
  fDesde: '01/06/2025',
  fHasta: '27/03/2026',
  idOrganismo: '301',
  idRegistro: '1',
  nombreOrganismo: ' TRIBUNAL DEL TRABAJO N\u00ba 1 - LA PLATA',
  registro: 'REGISTRO DE SENTENCIAS',
  texoIncluido: '',
};

type EmbedderResult = {
  data: ArrayLike<number>;
};

type Embedder = (
  texto: string,
  options: { pooling: 'mean'; normalize: true },
) => Promise<EmbedderResult>;

// Cargamos el modelo una sola vez (lazy singleton)
let embedderPromise: Promise<Embedder> | null = null;

function getEmbedder(): Promise<Embedder> {
  if (!embedderPromise) {
    embedderPromise = import('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2') as Promise<Embedder>,
    );
  }
  return embedderPromise;
}

function cargarStore(): EmbeddingEntry[] {
  try {
    if (!existsSync(EMBEDDINGS_DIR)) return [];
    const archivos = readdirSync(EMBEDDINGS_DIR).filter((f) => f.endsWith('.json'));
    const entries = archivos.map((f) => {
      return JSON.parse(readFileSync(join(EMBEDDINGS_DIR, f), 'utf-8')) as EmbeddingEntry;
    });
    console.log(`[EmbeddingsRepository] Cargados ${entries.length} embeddings desde disco.`);
    return entries;
  } catch (e) {
    console.error('[EmbeddingsRepository] Error leyendo embeddings desde disco:', e);
    return [];
  }
}

export class EmbeddingsRepository {
  private readonly store: EmbeddingEntry[];

  constructor() {
    mkdirSync(EMBEDDINGS_DIR, { recursive: true });
    this.store = cargarStore();
  }

  private persistirEntrada(entry: EmbeddingEntry): void {
    try {
      writeFileSync(join(EMBEDDINGS_DIR, `${entry.idCodigoAcceso}.json`), JSON.stringify(entry), 'utf-8');
    } catch (e) {
      console.error(`[EmbeddingsRepository] Error guardando ${entry.idCodigoAcceso}.json:`, e);
    }
  }

  async generarEmbedding(texto: string): Promise<number[]> {
    const embedder = await getEmbedder();
    const result = await embedder(texto, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  async guardar(entry: Omit<EmbeddingEntry, 'embedding'> & { texto: string }): Promise<EmbeddingEntry> {
    const { texto, ...meta } = entry;

    // Evitar duplicados por idCodigoAcceso
    const existe = this.store.findIndex((e) => e.idCodigoAcceso === meta.idCodigoAcceso);

    const embedding = await this.generarEmbedding(texto);
    const stored: EmbeddingEntry = { ...meta, embedding };

    if (existe >= 0) {
      this.store[existe] = stored;
    } else {
      this.store.push(stored);
    }

    this.persistirEntrada(stored);
    return stored;
  }

  buscarSimilares(embedding: number[], topK: number = 5): SimilarityResult[] {
    return this.store
      .map((entry) => ({
        idCodigoAcceso: entry.idCodigoAcceso,
        nroRegistro: entry.nroRegistro,
        caratula: entry.caratula,
        decision: entry.decision,
        score: this.cosineSimilarity(embedding, entry.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  count(): number {
    return this.store.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return normA && normB ? dot / (normA * normB) : 0;
  }

  async buscarRegistrosPorFechaYOrganismo(
    request: BuscarRegistrosRequest = {},
  ): Promise<BuscarRegistrosResult> {
    const payload: BuscarRegistrosPorFechaYOrganismoPayload = {
      ...DEFAULT_SCBA_PAYLOAD,
      ...request,
    };

    const response = await fetch(SCBA_BUSCAR_REGISTROS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Error consultando SCBA: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    const registros = this.parsearRegistrosDesdeHtml(html);
    return registros;
  }

  async obtenerRegistroVisualizar(
    request: ObtenerDocumentoSCBARequest,
  ): Promise<ObtenerDocumentoSCBAResult> {
    const response = await fetch(SCBA_OBTENER_REGISTRO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Error consultando documento SCBA: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return this.parsearDocumentoDesdeHtml(request.idCodigoAcceso, html);
  }

  private parsearRegistrosDesdeHtml(html: string): RegistroSCBA[] {
    const $ = load(html);
    const registros: RegistroSCBA[] = [];

    $('#grid-ListadoRegistros tbody tr').each((_i, fila) => {
      const celdas = $(fila).find('td');
      if (celdas.length < 5) return;

      const idCodigoAcceso = celdas.eq(0).text().trim();
      const nroRegistro = celdas.eq(1).text().trim();
      const fecha = celdas.eq(2).attr('data-order') ?? celdas.eq(2).text().trim();
      const nroExpediente = celdas.eq(3).text().trim();
      const caratula = celdas.eq(4).text().replace(/\s+/g, ' ').trim();

      if (!nroRegistro && !caratula) return;

      registros.push({
        idCodigoAcceso,
        nroRegistro,
        fecha,
        nroExpediente,
        caratula,
        anulada: !idCodigoAcceso || /^ANULADA$/i.test(caratula),
      });
    });

    return registros;
  }

  private parsearDocumentoDesdeHtml(idCodigoAcceso: string, html: string): DocumentoSCBA {
    const $ = load(html);

    const textoCompleto = $('p')
      .toArray()
      .map((el) => $(el).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n');

    const organismo = $('.card .card-header').first().text().replace(/\s+/g, ' ').trim() || 'SCBA';
    const causa =
      $('.card .card-body strong').first().text().replace(/\s+/g, ' ').trim() ||
      $('title').text().replace(/\s+/g, ' ').trim();

    const nroExpedienteMatch = html.match(/Expediente\s*N[°º]\s*([\w\-/]+)/i);
    const nroExpediente = nroExpedienteMatch?.[1]?.trim() ?? '';

    const secciones = this.extraerSecciones(textoCompleto);

    return {
      idCodigoAcceso,
      organismo,
      causa,
      nroExpediente,
      textoCompleto,
      hechos: secciones.antecedentes_y_objeto || this.extraerHechos(textoCompleto),
      decision: secciones.sentencia || this.extraerDecision(textoCompleto),
      secciones,
    };
  }

  private extraerSecciones(texto: string): Record<string, string> {
    const secciones: Record<string, string> = {};

    const idxAntecedentes = texto.search(/A\s*N\s*T\s*E\s*C\s*E\s*N\s*T\s*E\s*S\s*Y\s*O\s*B\s*J\s*E\s*T\s*O/i);
    const idxSentencia = texto.search(/S\s*E\s*N\s*T\s*E\s*N\s*C\s*I\s*A/i);

    if (idxAntecedentes >= 0) {
      const finAntecedentes = idxSentencia > idxAntecedentes ? idxSentencia : texto.length;
      secciones.antecedentes_y_objeto = texto.slice(idxAntecedentes, finAntecedentes).trim();
    }

    if (idxSentencia >= 0) {
      secciones.sentencia = texto.slice(idxSentencia).trim();
    }

    return secciones;
  }

  private extraerHechos(texto: string): string {
    const patrones = [
      /A\s*N\s*T\s*E\s*C\s*E\s*N\s*T\s*E\s*S\s*Y\s*O\s*B\s*J\s*E\s*T\s*O([\s\S]*?)(?=S\s*E\s*N\s*T\s*E\s*N\s*C\s*I\s*A|$)/i,
      /CUESTIONES\s+DE\s+HECHO([\s\S]*?)(?=S\s*E\s*N\s*T\s*E\s*N\s*C\s*I\s*A|$)/i,
    ];

    for (const p of patrones) {
      const m = texto.match(p);
      if (m?.[1]) return m[1].trim();
    }

    return texto.slice(0, 2500).trim();
  }

  private extraerDecision(texto: string): string {
    const match = texto.match(/(S\s*E\s*N\s*T\s*E\s*N\s*C\s*I\s*A|RESUELVE|POR\s+ELLO)([\s\S]*)$/i);
    const decision = match?.[0]?.trim();
    if (decision) return decision;
    return texto.slice(-2500).trim();
  }
}
