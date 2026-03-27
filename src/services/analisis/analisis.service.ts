import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { AnalizarConsultaRequest, AnalizarConsultaResult } from './types';

export class AnalisisService {
  constructor(
    private readonly _embeddingsRepository: EmbeddingsRepository,
    private readonly analisisRepository: AnalisisRepository,
  ) {}

  async analizar(req: AnalizarConsultaRequest): Promise<AnalizarConsultaResult> {
    return this.analisisRepository.analizar(req as Record<string, unknown>);
  }
}
