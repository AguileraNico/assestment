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

export interface RegistroSCBA {
  idCodigoAcceso: string;
  nroRegistro: string;
  fecha: string;
  nroExpediente: string;
  caratula: string;
  anulada: boolean;
}

export type BuscarRegistrosResult = RegistroSCBA[];

export interface SimilarityResult {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  decision: string;
  score: number;
}
