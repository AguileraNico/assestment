export type EmbeddingIndice =
  | 'despidos'
  | 'accidentes_trayecto'
  | 'accidentes_trabajo'
  | 'enfermedades'
  | 'otros';

export type EmbeddingSubindice =
  | 'despido_enfermedad'
  | 'despido_general'
  | 'despido_conciliacion'
  | 'despido_registracion'
  | 'enfermedad_profesional'
  | 'enfermedad_accidente'
  | 'enfermedad_procesal'
  | 'trayecto_general'
  | 'trabajo_general'
  | 'otro';

export interface EmbeddingEntry {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  indice: EmbeddingIndice;
  subindice: EmbeddingSubindice;
  demandante?: string;
  demandado?: string;
  tipoCausa?: string;
  quePaso?: string;
  resultadoCausa?: string;
  hechosExplicacion?: string;
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
  indice: EmbeddingIndice;
  subindice: EmbeddingSubindice;
  demandante?: string;
  demandado?: string;
  tipoCausa?: string;
  quePaso?: string;
  resultadoCausa?: string;
  decision: string;
  score: number;
}
