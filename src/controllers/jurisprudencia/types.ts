export interface AnalizarHttpBody {
  texto?: string;
  caso?: string;
  parametros?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
