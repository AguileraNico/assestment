import { randomUUID } from 'crypto';
import { load } from 'cheerio';
import {
  ResultadoAnalisis,
  BuscarSentenciasPayload,
  BuscarSentenciasResponse,
  SentenciaItem,
  ObtenerDocumentoPayload,
  DocumentoSentencia,
} from './types';
import { AnalizarRequest } from '../../services/jurisprudencia/types';

const SCBA_BASE_URL = 'https://sentencias-corte.scba.gov.ar/RegistroElectronico';

const DEFAULT_PAYLOAD: BuscarSentenciasPayload = {
  fDesde: '03/02/2025',
  fHasta: '14/03/2026',
  idOrganismo: '292',
  idRegistro: '4',
  nombreOrganismo: ' SECRETARIA LABORAL - SUPREMA CORTE DE JUSTICIA',
  registro: ' REGISTRO DE SENTENCIAS DE SUPREMA CORTE',
  texoIncluido: '',
};

export class JurisprudenciaRepository {
  // Almacenamiento en memoria — reemplazar por DB real
  private readonly store: Map<string, ResultadoAnalisis> = new Map();

  async guardar(data: AnalizarRequest): Promise<ResultadoAnalisis> {
    const registro: ResultadoAnalisis = {
      id: randomUUID(),
      texto: data.texto ?? null,
      caso: data.caso ?? null,
      parametros: data.parametros ?? {},
      estado: 'pendiente',
      timestamp: new Date().toISOString(),
    };

    this.store.set(registro.id, registro);
    return registro;
  }

  async buscarPorId(id: string): Promise<ResultadoAnalisis | null> {
    return this.store.get(id) ?? null;
  }

  async actualizar(id: string, cambios: Partial<ResultadoAnalisis>): Promise<ResultadoAnalisis | null> {
    const existente = this.store.get(id);
    if (!existente) return null;

    const actualizado = { ...existente, ...cambios };
    this.store.set(id, actualizado);
    return actualizado;
  }

  async buscarSentencias(
    payload: Partial<BuscarSentenciasPayload> = {},
  ): Promise<BuscarSentenciasResponse> {
    const body: BuscarSentenciasPayload = { ...DEFAULT_PAYLOAD, ...payload };

    const response = await fetch(
      `${SCBA_BASE_URL}/BuscarRegistrosPorFechaYOrganismo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${SCBA_BASE_URL}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Error al consultar SCBA: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    return this.parsearTablaHtml(html);
  }

  async obtenerDocumento(idCodigoAcceso: string): Promise<DocumentoSentencia> {
    const payload: ObtenerDocumentoPayload = { idCodigoAcceso };

    const response = await fetch(
      `${SCBA_BASE_URL}/ObtenerRegistroVisualizar/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/html, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${SCBA_BASE_URL}`,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Error al obtener documento SCBA: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();
    return this.parsearDocumentoHtml(idCodigoAcceso, html);
  }

  private parsearDocumentoHtml(idCodigoAcceso: string, html: string): DocumentoSentencia {
    const $ = load(html);

    // Metadata: primer card con Organismo y Causa/Número
    const metaCard   = $('.card').first();
    const organismo  = metaCard.find('p:contains("Organismo:")').text().replace('Organismo:', '').trim();
    const causaTexto = metaCard.find('p:contains("Causa:")').text();
    const causa      = causaTexto.split('-')[0].replace('Causa:', '').trim();
    const nroExpediente = causaTexto.match(/Número:\s*([^\s]+)/)?.[1] ?? '';

    // Texto completo del fallo: segundo card
    const parrafos: string[] = [];
    $('.card').eq(1).find('p').each((_i, el) => {
      const parrafo = $(el).text().trim();
      if (parrafo) parrafos.push(parrafo);
    });

    // Eliminamos la sección de VOTACIÓN (desarrollo argumental de los jueces).
    // Conservamos ANTECEDENTES (hechos) y SENTENCIA (resolución final).
    const textoCompleto = parrafos.join('\n\n');
    const texto = this.extraerSeccionesRelevantes(textoCompleto);

    return {
      idCodigoAcceso,
      organismo,
      causa,
      nroExpediente,
      texto,
    };
  }

  private extraerSeccionesRelevantes(texto: string): string {
    // El encabezado de sección aparece como "V O T A C I Ó N" (letras separadas por espacios)
    // o como "VOTACIÓN" solo en su línea. NO queremos matchear "votación" dentro de un párrafo.
    const patronVotacion = /^V\s+O\s+T\s+A\s+C\s+I\s+[OÓ]\s+N\s*$/im;
    const patronSentencia = /^S\s+E\s+N\s+T\s+E\s+N\s+C\s+I\s+A\s*$/im;

    const idxVotacion = texto.search(patronVotacion);
    const idxSentencia = texto.search(patronSentencia);

    // Si no tiene estructura de acuerdo, devolvemos el texto tal cual
    if (idxVotacion === -1) return texto;

    const antesDeVotacion = texto.slice(0, idxVotacion).trim();

    // Si hay SENTENCIA después de la VOTACIÓN, la incluimos
    const despuesDeSentencia =
      idxSentencia > idxVotacion
        ? texto.slice(idxSentencia).trim()
        : '';

    return [antesDeVotacion, despuesDeSentencia].filter(Boolean).join('\n\n');
  }

  private parsearTablaHtml(html: string): BuscarSentenciasResponse {
    const $ = load(html);
    const sentencias: SentenciaItem[] = [];

    // Columnas: [0] id (oculto, idCodigoAcceso) | [1] nroRegistro | [2] fecha | [3] nroExpediente | [4] caratula | [5] acciones
    $('#grid-ListadoRegistros tbody tr').each((_i, fila) => {
      const celdas = $(fila).find('td');

      const idCodigoAcceso = celdas.eq(0).text().trim();
      const nroRegistro    = celdas.eq(1).text().trim();
      const fecha          = celdas.eq(2).attr('data-order') ?? celdas.eq(2).text().trim();
      const nroExpediente  = celdas.eq(3).text().trim();
      const caratula       = celdas.eq(4).text().trim();

      if (nroRegistro) {
        sentencias.push({ idCodigoAcceso, nroRegistro, fecha, nroExpediente, caratula });
      }
    });

    return sentencias;
  }
}
