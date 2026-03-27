import { BuscarRegistrosRequest } from '../../repositories/embeddings/types';
import { PrepararRAGRequest } from '../../services/embeddings/types';

export interface ConsultarRegistrosSCBAHttpBody extends BuscarRegistrosRequest {}

export interface PrepararRAGHttpBody extends PrepararRAGRequest {}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
