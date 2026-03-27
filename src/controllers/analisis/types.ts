export interface AnalizarConsultaHttpBody {
  consulta?: string;
  topK?: number;
  umbralSimilitud?: number;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
