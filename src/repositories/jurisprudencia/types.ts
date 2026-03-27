export interface EndpointStubResponse {
  status: 'not_implemented';
  endpoint: '/jurisprudencia/analizar' | '/jurisprudencia/documento';
  message: string;
  request: Record<string, unknown>;
  recursos: {
    route: string;
    controller: string;
    service: string;
    repository: string;
  };
}
