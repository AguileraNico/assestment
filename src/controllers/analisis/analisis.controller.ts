import { Request, Response } from 'express';
import { AnalisisService } from '../../services/analisis/analisis.service';
import { AnalizarConsultaHttpBody, ErrorResponse } from './types';

export class AnalisisController {
  constructor(private readonly service: AnalisisService) {}

  analizar = async (req: Request<{}, {}, AnalizarConsultaHttpBody>, res: Response): Promise<void> => {
    const { consulta, topK, umbralSimilitud } = req.body;

    if (!consulta) {
      res.status(400).json({
        error: 'Se requiere el campo "consulta" en el body',
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
      const resultado = await this.service.analizar({ consulta, topK, umbralSimilitud });
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en AnalisisController.analizar:', error);
      res.status(500).json({
        error: 'Error al analizar la consulta',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
