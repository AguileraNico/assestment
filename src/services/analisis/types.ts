import { EndpointStubResponse } from '../../repositories/analisis/types';

export interface AnalizarConsultaRequest {
  consulta?: string;
  topK?: number;
  umbralSimilitud?: number;
}

export type AnalizarConsultaResult = EndpointStubResponse;
