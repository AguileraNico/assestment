import { BuscarRegistrosRequest } from '../../repositories/embeddings/types';
import { PrepararRAGRequest, BuscarPorConsultaRequest } from '../../services/embeddings/types';
import { GenerarEmbeddingsRequest } from '../../services/embeddings/types';

export interface ConsultarRegistrosSCBAHttpBody extends BuscarRegistrosRequest {}

export interface PrepararRAGHttpBody extends PrepararRAGRequest {}

export interface GenerarEmbeddingsHttpBody extends GenerarEmbeddingsRequest {}

export interface BuscarPorConsultaHttpBody extends BuscarPorConsultaRequest {}

export interface ErrorResponse {
  error: string;
  detail?: string;
}
