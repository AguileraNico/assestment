import { Request, Response } from 'express';
import { EmbeddingsService } from '../../services/embeddings/embeddings.service';
import { GenerarEmbeddingsHttpBody, BuscarSimilaresHttpBody, ErrorResponse } from './types';

export class EmbeddingsController {
  constructor(private readonly service: EmbeddingsService) {}

  generar = async (req: Request<{}, {}, GenerarEmbeddingsHttpBody>, res: Response): Promise<void> => {
    const { limite } = req.body;

    try {
      const resultado = await this.service.generarEmbeddings({ limite });
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en EmbeddingsController.generar:', error);
      res.status(500).json({
        error: 'Error al generar embeddings',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };

  buscarSimilares = async (req: Request<{}, {}, BuscarSimilaresHttpBody>, res: Response): Promise<void> => {
    const { texto, topK } = req.body;

    if (!texto) {
      res.status(400).json({
        error: 'Se requiere el campo "texto" en el body',
      } satisfies ErrorResponse);
      return;
    }

    if (this.service.storeCount() === 0) {
      res.status(409).json({
        error: 'El vector store está vacío. Ejecutá primero POST /embeddings/generar',
      } satisfies ErrorResponse);
      return;
    }

    try {
      const resultados = await this.service.buscarSimilares(texto, topK);
      res.status(200).json({ total: resultados.length, resultados });
    } catch (error) {
      console.error('Error en EmbeddingsController.buscarSimilares:', error);
      res.status(500).json({
        error: 'Error al buscar similares',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
