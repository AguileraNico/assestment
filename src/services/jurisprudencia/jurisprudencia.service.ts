import { AnalizarRequest, FiltrosBusqueda } from './types';
import { EndpointStubResponse } from '../../repositories/jurisprudencia/types';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';

export class JurisprudenciaService {
  constructor(private readonly repository: JurisprudenciaRepository) {}

  async analizar(data: AnalizarRequest): Promise<EndpointStubResponse> {
    return this.repository.analizar(data as Record<string, unknown>);
  }

  async obtenerDocumento(idCodigoAcceso: string): Promise<EndpointStubResponse> {
    return this.repository.obtenerDocumento({ idCodigoAcceso });
  }
}
