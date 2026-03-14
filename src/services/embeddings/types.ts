export interface GenerarEmbeddingsRequest {
  limite?: number;
}

export interface EmbeddingDocumentoResult {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  estado: 'ok' | 'error';
  error?: string;
}

export interface GenerarEmbeddingsResult {
  procesados: number;
  errores: number;
  total: number;
  documentos: EmbeddingDocumentoResult[];
}
