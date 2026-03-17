export interface EmbeddingEntry {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  decision: string;
  embedding: number[];
}

export interface SimilarityResult {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  decision: string;
  score: number;
}
