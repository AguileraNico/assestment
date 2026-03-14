export interface ResultadoAnalisis {
  id: string;
  texto: string | null;
  caso: string | null;
  parametros: Record<string, unknown>;
  estado: 'pendiente' | 'procesado' | 'error';
  timestamp: string;
}
