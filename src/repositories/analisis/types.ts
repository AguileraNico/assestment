import { SimilarityResult } from '../embeddings/types';

export interface AnalisisEntry {
  id: string;
  consulta: string;
  contextoCasos: SimilarityResult[];
  respuesta: string;
  timestamp: string;
}
