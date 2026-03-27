export interface EmbeddingEntry {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  decision: string;
  embedding: number[];
}

export interface BuscarRegistrosPorFechaYOrganismoPayload {
  fDesde: string;
  fHasta: string;
  idOrganismo: string;
  idRegistro: string;
  nombreOrganismo: string;
  registro: string;
  texoIncluido: string;
}

export interface BuscarRegistrosRequest extends Partial<BuscarRegistrosPorFechaYOrganismoPayload> {}

export interface ObtenerRegistroVisualizarPayload {
  idCodigoAcceso: string;
}

export interface ObtenerDocumentoSCBARequest extends ObtenerRegistroVisualizarPayload {}

export interface RegistroSCBA {
  idCodigoAcceso: string;
  nroRegistro: string;
  fecha: string;
  nroExpediente: string;
  caratula: string;
  anulada: boolean;
}

export type BuscarRegistrosResult = RegistroSCBA[];

export interface DocumentoSCBA {
  idCodigoAcceso: string;
  organismo: string;
  causa: string;
  nroExpediente: string;
  textoCompleto: string;
  hechos: string;
  decision: string;
  secciones: Record<string, string>;
}

export type ObtenerDocumentoSCBAResult = DocumentoSCBA;

export interface SimilarityResult {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  decision: string;
  score: number;
}
