export interface AnalizarRequest {
  texto?: string;
  caso?: string;
  parametros?: Record<string, unknown>;
}

export interface FiltrosBusqueda {
  fDesde?: string;
  fHasta?: string;
  texoIncluido?: string;
}
