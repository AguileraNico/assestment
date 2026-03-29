import {
  BuscarRegistrosRequest,
  EmbeddingIndice,
  EmbeddingSubindice,
  RegistroSCBA,
  DocumentoSCBA,
  BuscarRegistrosResult,
  ObtenerDocumentoSCBARequest,
  ObtenerDocumentoSCBAResult,
} from '../../repositories/embeddings/types';

export type ConsultarRegistrosSCBARequest = BuscarRegistrosRequest;

export type ConsultarRegistrosSCBAResult = BuscarRegistrosResult;

export type ConsultarDocumentoSCBARequest = ObtenerDocumentoSCBARequest;

export type ConsultarDocumentoSCBAResult = ObtenerDocumentoSCBAResult;

export interface PrepararRAGRequest extends BuscarRegistrosRequest {
  limite?: number;
  incluirAnuladas?: boolean;
  forzarActualizacion?: boolean;
}

export interface DocumentoRAG {
  idCodigoAcceso: string;
  nroRegistro: string;
  nroExpediente: string;
  caratula: string;
  antecedentes: string;
  sentencia: string;
  hechos_estructurados?: {
    que_paso: string;
    evento: string;
    contexto: string;
    actores: string;
    consecuencia: string;
    controversia: string;
    explicacion: string;
  };
}

export interface DocumentoProcesadoCache extends DocumentoRAG {
  timestamp: string;
}

export interface PrepararRAGResult {
  totalRegistros: number;
  procesados: number;
  errores: number;
  documentos: DocumentoRAG[];
}

export interface GenerarEmbeddingsRequest {
  limite?: number;
}

export interface GenerarEmbeddingsResult {
  totalDisponibles: number;
  procesados: number;
  errores: number;
}

export interface BuscarPorConsultaRequest {
  consulta: string;
  topK?: number;
  generarRespuesta?: boolean;
  indice?: EmbeddingIndice;
  subindice?: EmbeddingSubindice;
}

export interface ResultadoBusqueda {
  idCodigoAcceso: string;
  nroRegistro: string;
  caratula: string;
  indice: EmbeddingIndice;
  subindice: EmbeddingSubindice;
  demandante: string;
  demandado: string;
  tipo_causa: string;
  que_paso: string;
  resultado_causa: string;
  score: number;
  relevancia: 'alta' | 'media' | 'baja';
}

export interface BuscarPorConsultaResult {
  consulta: string;
  indiceUsado?: EmbeddingIndice;
  subindiceUsado?: EmbeddingSubindice;
  resultados: ResultadoBusqueda[];
  totalEncontrados: number;
  respuesta?: string;
}
