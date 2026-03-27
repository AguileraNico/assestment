import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import {
  ConsultarRegistrosSCBARequest,
  ConsultarRegistrosSCBAResult,
  ConsultarDocumentoSCBARequest,
  ConsultarDocumentoSCBAResult,
  DocumentoRAG,
  DocumentoProcesadoCache,
  PrepararRAGRequest,
  PrepararRAGResult,
} from './types';
import { DocumentoSCBA, RegistroSCBA } from '../../repositories/embeddings/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SENTENCIAS_CACHE_DIR = join(process.cwd(), 'data', 'sentencias');

export class EmbeddingsService {
  constructor(private readonly embeddingsRepository: EmbeddingsRepository) {}

  async consultarRegistrosSCBA(
    req: ConsultarRegistrosSCBARequest = {},
  ): Promise<ConsultarRegistrosSCBAResult> {
    return this.embeddingsRepository.buscarRegistrosPorFechaYOrganismo(req);
  }

  async consultarDocumentoSCBA(
    req: ConsultarDocumentoSCBARequest,
  ): Promise<ConsultarDocumentoSCBAResult> {
    return this.embeddingsRepository.obtenerRegistroVisualizar(req);
  }

  async prepararRAG(request: PrepararRAGRequest): Promise<PrepararRAGResult> {
    const { limite = 10, incluirAnuladas = false, forzarActualizacion = false, ...buscarReq } = request;

    const registros = await this.consultarRegistrosSCBA(buscarReq);
    const candidatos = registros
      .filter((r) => incluirAnuladas || !r.anulada)
      .filter((r) => Boolean(r.idCodigoAcceso))
      .slice(0, limite);

    const documentos: DocumentoRAG[] = [];
    let errores = 0;

    for (const registro of candidatos) {
      try {
        if (!forzarActualizacion) {
          const cached = this.leerCacheProcesado(registro.idCodigoAcceso);
          if (cached) {
            documentos.push(cached);
            continue;
          }
        }

        const documento = await this.consultarDocumentoSCBA({ idCodigoAcceso: registro.idCodigoAcceso });
        const rag = this.generarDocumentoRAGExtractivo(registro, documento);

        this.escribirCacheProcesado({
          ...rag,
          timestamp: new Date().toISOString(),
        });

        documentos.push(rag);
      } catch (error) {
        console.error(`[EmbeddingsService] Error preparando RAG para ${registro.idCodigoAcceso}:`, error);
        errores += 1;
      }
    }

    return {
      totalRegistros: registros.length,
      procesados: documentos.length,
      errores,
      documentos,
    };
  }

  private generarDocumentoRAGExtractivo(
    registro: RegistroSCBA,
    documento: DocumentoSCBA,
  ): DocumentoRAG {
    const antecedentesFuente = documento.secciones.antecedentes_y_objeto || documento.hechos || '';
    const sentenciaFuente = documento.secciones.sentencia || documento.decision || '';

    return {
      idCodigoAcceso: registro.idCodigoAcceso,
      nroRegistro: registro.nroRegistro,
      nroExpediente: registro.nroExpediente,
      caratula: registro.caratula,
      antecedentes: this.resumenExtractivo(antecedentesFuente, 1400),
      sentencia: this.resumenExtractivo(sentenciaFuente, 1400),
    };
  }

  private resumenExtractivo(texto: string, maxLen: number): string {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    if (!limpio) return 'No surge del texto';
    if (limpio.length <= maxLen) return limpio;
    return `${limpio.slice(0, maxLen).trim()}...`;
  }

  private leerCacheProcesado(idCodigoAcceso: string): DocumentoRAG | null {
    const cachePath = join(SENTENCIAS_CACHE_DIR, `${idCodigoAcceso}.json`);
    if (!existsSync(cachePath)) return null;

    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as DocumentoProcesadoCache;
      const { timestamp, ...rag } = cached;
      return rag as DocumentoRAG;
    } catch {
      return null;
    }
  }

  private escribirCacheProcesado(data: DocumentoProcesadoCache): void {
    try {
      mkdirSync(SENTENCIAS_CACHE_DIR, { recursive: true });
      const cachePath = join(SENTENCIAS_CACHE_DIR, `${data.idCodigoAcceso}.json`);
      writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[EmbeddingsService] Error guardando cache procesado:', error);
    }
  }
}
