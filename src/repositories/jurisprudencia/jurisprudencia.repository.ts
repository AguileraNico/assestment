import { EndpointStubResponse } from './types';

export class JurisprudenciaRepository {
  async analizar(request: Record<string, unknown>): Promise<EndpointStubResponse> {
    return {
      status: 'not_implemented',
      endpoint: '/jurisprudencia/analizar',
      message: 'Endpoint deshabilitado temporalmente. Se conservaron los recursos para reiniciar la implementacion.',
      request,
      recursos: {
        route: 'src/routes/jurisprudencia/jurisprudencia.ts',
        controller: 'src/controllers/jurisprudencia/jurisprudencia.controller.ts',
        service: 'src/services/jurisprudencia/jurisprudencia.service.ts',
        repository: 'src/repositories/jurisprudencia/jurisprudencia.repository.ts',
      },
    };
  }

  async obtenerDocumento(request: Record<string, unknown>): Promise<EndpointStubResponse> {
    return {
      status: 'not_implemented',
      endpoint: '/jurisprudencia/documento',
      message: 'Endpoint deshabilitado temporalmente. Se conservaron los recursos para reiniciar la implementacion.',
      request,
      recursos: {
        route: 'src/routes/jurisprudencia/jurisprudencia.ts',
        controller: 'src/controllers/jurisprudencia/jurisprudencia.controller.ts',
        service: 'src/services/jurisprudencia/jurisprudencia.service.ts',
        repository: 'src/repositories/jurisprudencia/jurisprudencia.repository.ts',
      },
    };
  }
}
