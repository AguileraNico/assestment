import { Request, Response } from 'express';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { ConsultarRegistrosSCBAHttpBody, ErrorResponse, PrepararRAGHttpBody } from './types';
import {
  ConsultarRegistrosSCBAResult,
  ConsultarDocumentoSCBAResult,
  PrepararRAGResult,
} from '../../services/embeddings/types';

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

  consultarDocumentoSCBA = async (
    req: Request<{}, {}, { idCodigoAcceso: string }>,
    res: Response<ConsultarDocumentoSCBAResult | ErrorResponse>,
  ): Promise<void> => {
    try {
      const resultado = await this.service.consultarDocumentoSCBA(req.body);
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en EmbeddingsController.consultarDocumentoSCBA:', error);
      res.status(500).json({
        error: 'Error al consultar documento SCBA',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };

  prepararRAG = async (
    req: Request<{}, {}, PrepararRAGHttpBody>,
    res: Response<PrepararRAGResult | ErrorResponse>,
  ): Promise<void> => {
    try {
      const resultado = await this.service.prepararRAG(req.body ?? {});
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en EmbeddingsController.prepararRAG:', error);
      res.status(500).json({
        error: 'Error al preparar RAG',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
