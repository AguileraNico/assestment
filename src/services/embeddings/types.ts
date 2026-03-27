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
