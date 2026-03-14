export interface EmbeddingEntry {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  embedding: number[];
}

export interface SimilarityResult {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  score: number;
}
