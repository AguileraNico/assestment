export interface EndpointStubResponse {
  status: 'not_implemented';
  endpoint: '/analisis/analizar';
  message: string;
  request: Record<string, unknown>;
  recursos: {
    route: string;
    controller: string;
    service: string;
    repository: string;
  };
}
