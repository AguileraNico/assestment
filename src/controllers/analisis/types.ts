export interface AnalizarConsultaHttpBody {
  consulta: string;
  topK?: number;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
