export interface ResultadoAnalisis {
  id: string;
  texto: string | null;
  caso: string | null;
  parametros: Record<string, unknown>;
  estado: 'pendiente' | 'procesado' | 'error';
  timestamp: string;
}

export interface BuscarSentenciasPayload {
  fDesde: string;
  fHasta: string;
  idOrganismo: string;
  idRegistro: string;
  nombreOrganismo: string;
  registro: string;
  texoIncluido: string;
}

export interface SentenciaItem {
  idCodigoAcceso: string;
  nroRegistro: string;
  fecha: string;
  nroExpediente: string;
  caratula: string;
}

export type BuscarSentenciasResponse = SentenciaItem[];

export interface ObtenerDocumentoPayload {
  idCodigoAcceso: string;
}

export interface DocumentoSentencia {
  idCodigoAcceso: string;
  organismo: string;
  causa: string;
  nroExpediente: string;
  texto: string;
}

export interface ResumenSentencia {
  idCodigoAcceso: string;
  nroRegistro: string;
  fecha: string;
  caratula: string;
  actora: string;
  demandada: string;
  tipoAccion: string;
  organismo: string;
  extracto: string;    // primeros ~800 chars del texto
  resolucion: string;  // últimos ~500 chars del texto
}
