import { SimilarityResult } from '../embeddings/types';

export interface SentenciaEstructurada {
  case_name: string | null;
  case_number: string | null;
  court: string | null;
  area: string | null;
  date: string | null;
  parties: {
    plaintiff: string | null;
    defendants: string[];
  };
  case_type: string | null;
  facts: string | null;
  legal_issues: string[];
  laws_cited: string[];
  precedents_cited: string[];
  decision_summary: string | null;
  outcome: string | null;
  damages_or_compensation: string | null;
  key_arguments: string[];
  keywords: string[];
}

export interface SimilarCase {
  case_name: string;
  similarity_reason: string;
}

export interface AnalisisRespuesta {
  case_summary: string;
  similar_cases: SimilarCase[];
  favorable_factors: string[];
  risk_factors: string[];
  suggested_arguments: string[];
  relevant_precedents: string[];
}

export interface AnalisisEntry {
  id: string;
  consulta: string;
  contextoCasos: SimilarityResult[];
  respuesta: AnalisisRespuesta;
  timestamp: string;
}
