import { AnalisisRespuesta } from '../../repositories/analisis/types';

export interface AnalizarConsultaRequest {
  consulta: string;
  topK?: number;
  umbralSimilitud?: number;
}

export interface AnalizarConsultaResult {
  id: string;
  consulta: string;
  sinCoincidencias?: true;
  casosUsados: {
    nroRegistro: string;
    caratula: string;
    score: number;
  }[];
  respuesta: AnalisisRespuesta | null;
  timestamp: string;
}
