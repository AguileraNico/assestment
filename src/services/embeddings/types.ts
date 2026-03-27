import {
  BuscarRegistrosRequest,
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
}

export interface BuscarPorConsultaResult {
  consulta: string;
  resultados: Array<{
    idCodigoAcceso: string;
    nroRegistro: string;
    caratula: string;
    score: number;
  }>;
  totalEncontrados: number;
}
