import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import {
  ConsultarRegistrosSCBARequest,
  ConsultarRegistrosSCBAResult,
  ConsultarDocumentoSCBARequest,
  ConsultarDocumentoSCBAResult,
  DocumentoRAG,
  DocumentoProcesadoCache,
  PrepararRAGRequest,
  PrepararRAGResult,
  GenerarEmbeddingsRequest,
  GenerarEmbeddingsResult,
  BuscarPorConsultaRequest,
  BuscarPorConsultaResult,
} from './types';
import { DocumentoSCBA, RegistroSCBA } from '../../repositories/embeddings/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Groq from 'groq-sdk';

const SENTENCIAS_CACHE_DIR = join(process.cwd(), 'data', 'sentencias');

export class EmbeddingsService {
  private readonly groqClient: Groq | null;
  private readonly modelHechos = 'llama-3.1-8b-instant';

  constructor(private readonly embeddingsRepository: EmbeddingsRepository) {
    this.groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
  }

  async consultarRegistrosSCBA(
    req: ConsultarRegistrosSCBARequest = {},
  ): Promise<ConsultarRegistrosSCBAResult> {
    return this.embeddingsRepository.buscarRegistrosPorFechaYOrganismo(req);
  }

  async consultarDocumentoSCBA(
    req: ConsultarDocumentoSCBARequest,
  ): Promise<ConsultarDocumentoSCBAResult> {
    return this.embeddingsRepository.obtenerRegistroVisualizar(req);
  }

  async prepararRAG(request: PrepararRAGRequest): Promise<PrepararRAGResult> {
    const { limite = 10, incluirAnuladas = false, forzarActualizacion = false, ...buscarReq } = request;

    const registros = await this.consultarRegistrosSCBA(buscarReq);
    const candidatos = registros
      .filter((r) => incluirAnuladas || !r.anulada)
      .filter((r) => Boolean(r.idCodigoAcceso))
      .slice(0, limite);

    const documentos: DocumentoRAG[] = [];
    let errores = 0;

    for (const registro of candidatos) {
      try {
        if (!forzarActualizacion) {
          const cached = this.leerCacheProcesado(registro.idCodigoAcceso);
          if (cached) {
            documentos.push(cached);
            continue;
          }
        }

        const documento = await this.consultarDocumentoSCBA({ idCodigoAcceso: registro.idCodigoAcceso });
        const rag = await this.generarDocumentoRAG(registro, documento);

        this.escribirCacheProcesado({
          ...rag,
          timestamp: new Date().toISOString(),
        });

        documentos.push(rag);
      } catch (error) {
        console.error(`[EmbeddingsService] Error preparando RAG para ${registro.idCodigoAcceso}:`, error);
        errores += 1;
      }
    }

    return {
      totalRegistros: registros.length,
      procesados: documentos.length,
      errores,
      documentos,
    };
  }

  private async generarDocumentoRAG(
    registro: RegistroSCBA,
    documento: DocumentoSCBA,
  ): Promise<DocumentoRAG> {
    const base = this.generarDocumentoRAGExtractivo(registro, documento);

    if (!this.groqClient) {
      return {
        ...base,
        hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
      };
    }

    try {
      const fuente = this.extraerBloqueFactualParaLLM(documento);
      const completion = await this.groqClient.chat.completions.create({
        model: this.modelHechos,
        temperature: 0,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content:
              'Extrae hechos juridicos laborales en JSON valido, sin markdown, sin inferencias ni lenguaje procesal. Si un dato no surge, usa "No surge".',
          },
          {
            role: 'user',
            content:
              `Del texto, devolve SOLO este JSON con claves exactas: {"que_paso":"","evento":"","contexto":"","actores":"","consecuencia":"","controversia":"","explicacion":""}.\n\nReglas:\n- que_paso: 1 frase (max 25 palabras), debe responder literalmente que ocurrio.\n- explicacion: 80-160 palabras, centrada en hechos del caso, sin articulos de ley ni formula judicial.\n- no inventar datos ni completar vacios con supuestos.\n- si falta informacion, usar "No surge".\n\nTexto fuente:\n${fuente}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content ?? '';
      const hechos = this.parsearHechosEstructurados(raw);

      if (!hechos) {
        return {
          ...base,
          hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
        };
      }

      return {
        ...base,
        antecedentes: hechos.explicacion || base.antecedentes,
        hechos_estructurados: this.normalizarHechosEstructurados(hechos),
      };
    } catch (error) {
      console.error('[EmbeddingsService] Error en extraccion Groq, usando fallback extractivo:', error);
      return {
        ...base,
        hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
      };
    }
  }

  async generarEmbeddings(request: GenerarEmbeddingsRequest = {}): Promise<GenerarEmbeddingsResult> {
    const { limite = 100 } = request;

    if (!existsSync(SENTENCIAS_CACHE_DIR)) {
      return { totalDisponibles: 0, procesados: 0, errores: 0 };
    }

    const archivos = readdirSync(SENTENCIAS_CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .slice(0, limite);

    let procesados = 0;
    let errores = 0;

    for (const archivo of archivos) {
      try {
        const cachePath = join(SENTENCIAS_CACHE_DIR, archivo);
        const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as DocumentoProcesadoCache;

        const textoBase = this.construirTextoParaEmbedding(cached);
        await this.embeddingsRepository.guardar({
          idCodigoAcceso: cached.idCodigoAcceso,
          nroRegistro: cached.nroRegistro,
          caratula: cached.caratula,
          decision: cached.sentencia,
          texto: textoBase,
        });

        procesados += 1;
      } catch (error) {
        console.error(`[EmbeddingsService] Error generando embedding para ${archivo}:`, error);
        errores += 1;
      }
    }

    return {
      totalDisponibles: archivos.length,
      procesados,
      errores,
    };
  }

  async buscarPorConsulta(request: BuscarPorConsultaRequest): Promise<BuscarPorConsultaResult> {
    const { consulta, topK = 5 } = request;

    if (!consulta || consulta.trim().length === 0) {
      return {
        consulta,
        resultados: [],
        totalEncontrados: 0,
      };
    }

    try {
      const queryEmbedding = await this.embeddingsRepository.generarEmbedding(consulta);
      const resultados = this.embeddingsRepository.buscarSimilares(queryEmbedding, topK);

      return {
        consulta,
        resultados: resultados.map((r) => ({
          idCodigoAcceso: r.idCodigoAcceso,
          nroRegistro: r.nroRegistro,
          caratula: r.caratula,
          score: Math.round(r.score * 1000) / 1000, // Round to 3 decimals
        })),
        totalEncontrados: resultados.length,
      };
    } catch (error) {
      console.error('[EmbeddingsService] Error en búsqueda semántica:', error);
      return {
        consulta,
        resultados: [],
        totalEncontrados: 0,
      };
    }
  }

  private generarDocumentoRAGExtractivo(
    registro: RegistroSCBA,
    documento: DocumentoSCBA,
  ): DocumentoRAG {
    const antecedentesFuente = documento.secciones.antecedentes_y_objeto || documento.hechos || '';
    const sentenciaFuente = documento.secciones.sentencia || documento.decision || '';

    return {
      idCodigoAcceso: registro.idCodigoAcceso,
      nroRegistro: registro.nroRegistro,
      nroExpediente: registro.nroExpediente,
      caratula: registro.caratula,
      antecedentes: this.resumenExtractivo(antecedentesFuente, 1400),
      sentencia: this.resumenExtractivo(sentenciaFuente, 1400),
    };
  }

  private resumenExtractivo(texto: string, maxLen: number): string {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    if (!limpio) return 'No surge del texto';
    if (limpio.length <= maxLen) return limpio;
    return `${limpio.slice(0, maxLen).trim()}...`;
  }

  private construirTextoParaEmbedding(doc: DocumentoRAG): string {
    // Embedding solo con hechos para maximizar similitud semantica por "que paso"
    const explicacion = doc.hechos_estructurados?.explicacion?.trim() || '';
    return (explicacion || doc.antecedentes || '').trim();
  }

  private parsearHechosEstructurados(raw: string): DocumentoRAG['hechos_estructurados'] | null {
    const trimmed = raw.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0];
    if (!jsonText) return null;

    try {
      const obj = JSON.parse(jsonText) as Record<string, unknown>;
      const get = (k: string): string => {
        const v = obj[k];
        if (typeof v !== 'string') return 'No surge';
        const s = v.replace(/\s+/g, ' ').trim();
        return s || 'No surge';
      };

      return {
        que_paso: get('que_paso'),
        evento: get('evento'),
        contexto: get('contexto'),
        actores: get('actores'),
        consecuencia: get('consecuencia'),
        controversia: get('controversia'),
        explicacion: get('explicacion'),
      };
    } catch {
      return null;
    }
  }

  private fallbackHechosEstructurados(antecedentes: string): NonNullable<DocumentoRAG['hechos_estructurados']> {
    const limpio = this.extraerExplicacionFallback(antecedentes);
    const lower = limpio.toLowerCase();
    const detectar = (re: RegExp): boolean => re.test(lower);

    const evento = detectar(/accidente|infortunio|lesion|lesi[oó]n/)
      ? 'Accidente laboral'
      : detectar(/despido|desvincul|distracto/)
      ? 'Despido'
      : detectar(/enfermedad|patolog/i)
      ? 'Enfermedad laboral'
      : 'No surge';

    const contexto = detectar(/in itinere|trayecto|domicilio|trabajo|moto|motocicleta|veh[ií]culo/)
      ? 'Traslado o contexto laboral'
      : 'No surge';

    const consecuencia = detectar(/incapacidad|da[nñ]o|lesi[oó]n|indemnizaci[oó]n/)
      ? 'Se reclaman consecuencias laborales o resarcitorias'
      : 'No surge';

    const controversia = detectar(/rechaza|rechazo|responsabilidad|cobertura|justificad|legitim/)
      ? 'Se discute la procedencia del reclamo o la responsabilidad'
      : 'No surge';

    return this.normalizarHechosEstructurados({
      que_paso: evento !== 'No surge' ? `${evento} en contexto laboral` : 'No surge',
      evento,
      contexto,
      actores: 'No surge',
      consecuencia,
      controversia,
      explicacion: limpio || 'No surge del texto',
    });
  }

  private normalizarHechosEstructurados(
    hechos: NonNullable<DocumentoRAG['hechos_estructurados']>,
  ): NonNullable<DocumentoRAG['hechos_estructurados']> {
    const limpiar = (s: string): string =>
      (s || '')
        .replace(/\s+/g, ' ')
        .replace(/^(se\s+re[uú]nen\s+los\s+jueces[^.]*\.?)/i, '')
        .trim();

    const explicacion = limpiar(hechos.explicacion) || 'No surge';
    let quePaso = limpiar(hechos.que_paso);

    const esProcesal = /(jueces|tribunal|dictar|veredicto|sentencia)/i.test(quePaso);
    if (!quePaso || quePaso === 'No surge' || esProcesal) {
      const oraciones = explicacion.split(/(?<=[.!?])\s+/).map((s) => s.trim());
      const factual = oraciones.find((s) =>
        /(trabajador|trabajadora|actor|actora|reclama|demanda|accidente|despido|lesi[oó]n|incapacidad|empresa|empleador)/i.test(
          s,
        ),
      );
      quePaso = (factual || oraciones[0] || 'No surge').slice(0, 180).trim();
    }

    return {
      ...hechos,
      que_paso: quePaso || 'No surge',
      explicacion,
    };
  }

  private extraerBloqueFactualParaLLM(documento: DocumentoSCBA): string {
    const fuentePrimaria =
      documento.secciones.antecedentes_y_objeto || documento.hechos || documento.textoCompleto || '';

    const texto = fuentePrimaria
      .replace(/\s+/g, ' ')
      .replace(/(AUTOS Y VISTOS|VISTOS|SENTENCIA|VEREDICTO|CUESTIONES)\b/gi, ' ')
      .trim();

    const oraciones = texto
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40);

    const clavesFacticas =
      /(trabajador|trabajadora|actor|actora|demanda|reclama|accidente|trayecto|in itinere|moto|lesi[oó]n|incapacidad|despido|empresa|empleador|art|afip|telegrama|intim[oó]|rechaz[oó]|cobertura)/i;

    const seleccion = oraciones.filter((s) => clavesFacticas.test(s)).slice(0, 18);
    const base = (seleccion.length ? seleccion : oraciones.slice(0, 18)).join(' ');
    return base.slice(0, 3600);
  }

  private extraerExplicacionFallback(texto: string): string {
    const sinSaltos = (texto || '').replace(/\s+/g, ' ').trim();
    if (!sinSaltos) return 'No surge del texto';

    // Quitar marcadores procesales frecuentes que meten ruido
    const limpio = sinSaltos
      .replace(/Organismo:\s*[^.]+\.?/gi, ' ')
      .replace(/Causa:\s*[^.]+\.?/gi, ' ')
      .replace(/N[uú]mero:\s*[^.]+\.?/gi, ' ')
      .replace(/(VISTOS|AUTOS Y VISTOS|SENTENCIA|VEREDICTO|CUESTIONES)\b/gi, ' ')
      .replace(/art[íi]?culo\s+\d+[\w\s.,°º-]*/gi, ' ')
      .replace(/arts?\.\s*[\d.,\s]+[\w\s.,°º-]*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Seleccionar oraciones con contenido factual
    const oraciones = limpio
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30);

    const relevantes = oraciones.filter((s) =>
      /(trabajador|actora|actor|demanda|reclama|accidente|despido|lesi[oó]n|incapacidad|art|empresa|empleador|trayecto|moto|laboral)/i.test(
        s,
      ),
    );

    const base = (relevantes.length ? relevantes : oraciones).slice(0, 5).join(' ');
    return base.slice(0, 900).trim() || 'No surge del texto';
  }

  private leerCacheProcesado(idCodigoAcceso: string): DocumentoRAG | null {
    const cachePath = join(SENTENCIAS_CACHE_DIR, `${idCodigoAcceso}.json`);
    if (!existsSync(cachePath)) return null;

    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as DocumentoProcesadoCache;
      const { timestamp, ...rag } = cached;
      return rag as DocumentoRAG;
    } catch {
      return null;
    }
  }

  private escribirCacheProcesado(data: DocumentoProcesadoCache): void {
    try {
      mkdirSync(SENTENCIAS_CACHE_DIR, { recursive: true });
      const cachePath = join(SENTENCIAS_CACHE_DIR, `${data.idCodigoAcceso}.json`);
      writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[EmbeddingsService] Error guardando cache procesado:', error);
    }
  }
}
