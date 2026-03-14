export interface GenerarEmbeddingsHttpBody {
  limite?: number;
}

export interface BuscarSimilaresHttpBody {
  texto: string;
  topK?: number;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
