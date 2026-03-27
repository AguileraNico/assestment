import { Request, Response } from 'express';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { ConsultarRegistrosSCBAHttpBody, ErrorResponse } from './types';
import { ConsultarRegistrosSCBAResult } from '../../services/embeddings/types';

export class EmbeddingsController {
  constructor(private readonly service: EmbeddingsService) {}

  consultarRegistrosSCBA = async (
    req: Request<{}, {}, ConsultarRegistrosSCBAHttpBody>,
    res: Response<ConsultarRegistrosSCBAResult | ErrorResponse>,
  ): Promise<void> => {
    try {
      const resultado = await this.service.consultarRegistrosSCBA(req.body ?? {});
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en EmbeddingsController.consultarRegistrosSCBA:', error);
      res.status(500).json({
        error: 'Error al consultar registros SCBA',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
