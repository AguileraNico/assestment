import { BuscarRegistrosRequest } from '../../repositories/embeddings/types';

export interface ConsultarRegistrosSCBAHttpBody extends BuscarRegistrosRequest {}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
