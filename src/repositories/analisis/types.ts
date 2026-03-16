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
  case_id: string;
  case_name: string;
  facts_similarity: string;
  decision: string;
  rejection_reason: 'merits' | 'prescription' | 'incompetence' | 'res_judicata' | 'other' | null;
  relevance: 'high' | 'medium' | 'low';
  supports_client: boolean;
}

export interface AnalisisRespuesta {
  case_summary: string;
  similar_cases: SimilarCase[];
  cases_supporting_client: number;
  cases_against_client: number;
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
