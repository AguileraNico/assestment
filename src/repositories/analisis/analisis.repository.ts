import { EndpointStubResponse } from './types';

export class AnalisisRepository {
  async analizar(request: Record<string, unknown>): Promise<EndpointStubResponse> {
    return {
      status: 'not_implemented',
      endpoint: '/analisis/analizar',
      message: 'Endpoint deshabilitado temporalmente. Se conservaron los recursos para reiniciar la implementacion.',
      request,
      recursos: {
        route: 'src/routes/analisis/analisis.ts',
        controller: 'src/controllers/analisis/analisis.controller.ts',
        service: 'src/services/analisis/analisis.service.ts',
        repository: 'src/repositories/analisis/analisis.repository.ts',
      },
    };
  }
}
