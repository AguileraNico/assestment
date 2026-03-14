import { Request, Response } from 'express';
import { JurisprudenciaService } from '../../services/jurisprudencia/jurisprudencia.service';
import { AnalizarHttpBody, ErrorResponse } from './types';
import { AnalizarRequest } from '../../services/jurisprudencia/types';

export class JurisprudenciaController {
  constructor(private readonly service: JurisprudenciaService) {}

  analizar = async (req: Request<{}, {}, AnalizarHttpBody>, res: Response): Promise<void> => {
    const { texto, caso, parametros } = req.body;

    if (!texto && !caso) {
      res.status(400).json({
        error: 'Se requiere al menos el campo "texto" o "caso" en el body',
      } satisfies ErrorResponse);
      return;
    }

    try {
      const resultado = await this.service.analizar({ texto, caso, parametros });
      res.status(200).json(resultado);
    } catch (error) {
      console.error('Error en JurisprudenciaController.analizar:', error);
      res.status(500).json({
        error: 'Error al procesar el análisis',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  };
}
