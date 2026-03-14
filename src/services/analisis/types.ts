export interface AnalizarConsultaRequest {
  consulta: string;
  topK?: number;
}

export interface AnalizarConsultaResult {
  id: string;
  consulta: string;
  casosUsados: {
    nroRegistro: string;
    caratula: string;
    score: number;
  }[];
  respuesta: string;
  timestamp: string;
}
