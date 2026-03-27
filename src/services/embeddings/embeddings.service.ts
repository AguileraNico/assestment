import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import {
  ConsultarRegistrosSCBARequest,
  ConsultarRegistrosSCBAResult,
} from './types';

export class EmbeddingsService {
  constructor(private readonly embeddingsRepository: EmbeddingsRepository) {}

  async consultarRegistrosSCBA(
    req: ConsultarRegistrosSCBARequest = {},
  ): Promise<ConsultarRegistrosSCBAResult> {
    return this.embeddingsRepository.buscarRegistrosPorFechaYOrganismo(req);
  }
}
