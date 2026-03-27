import { Request, Response } from 'express';
import { AnalisisService } from '../../services/analisis/analisis.service';
import { AnalizarConsultaHttpBody, ErrorResponse } from './types';
import { AnalizarConsultaResult } from '../../services/analisis/types';

export class AnalisisController {
  constructor(private readonly service: AnalisisService) {}

  analizar = async (
    req: Request<{}, {}, AnalizarConsultaHttpBody>,
    res: Response<AnalizarConsultaResult | ErrorResponse>,
  ): Promise<void> => {
    try {
      const resultado = await this.service.analizar(req.body ?? {});
      res.status(501).json(resultado);
    } catch (error) {
      console.error('Error en AnalisisController.analizar:', error);
      res.status(500).json({
        error: 'Error al analizar la consulta',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
