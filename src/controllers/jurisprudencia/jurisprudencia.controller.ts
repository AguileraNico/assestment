import { Request, Response } from 'express';
import { JurisprudenciaService } from '../../services/jurisprudencia/jurisprudencia.service';
import { AnalizarHttpBody, ObtenerDocumentoHttpBody, ErrorResponse } from './types';
import { EndpointStubResponse } from '../../repositories/jurisprudencia/types';

export class JurisprudenciaController {
  constructor(private readonly service: JurisprudenciaService) {}

  analizar = async (
    req: Request<{}, {}, AnalizarHttpBody>,
    res: Response<EndpointStubResponse | ErrorResponse>,
  ): Promise<void> => {
    try {
      const resultado = await this.service.analizar(req.body ?? {});
      res.status(501).json(resultado);
    } catch (error) {
      console.error('Error en JurisprudenciaController.analizar:', error);
      res.status(500).json({
        error: 'Error al procesar el análisis',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };

  obtenerDocumento = async (
    req: Request<{}, {}, ObtenerDocumentoHttpBody>,
    res: Response<EndpointStubResponse | ErrorResponse>,
  ): Promise<void> => {
    try {
      const documento = await this.service.obtenerDocumento(req.body?.idCodigoAcceso ?? '');
      res.status(501).json(documento);
    } catch (error) {
      console.error('Error en JurisprudenciaController.obtenerDocumento:', error);
      res.status(500).json({
        error: 'Error al obtener el documento',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      } satisfies ErrorResponse);
    }
  };
}
