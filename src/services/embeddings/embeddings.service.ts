import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';
import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { SimilarityResult } from '../../repositories/embeddings/types';
import { GenerarEmbeddingsRequest, GenerarEmbeddingsResult, EmbeddingDocumentoResult } from './types';

export class EmbeddingsService {
  constructor(
    private readonly jurisprudenciaRepository: JurisprudenciaRepository,
    private readonly embeddingsRepository: EmbeddingsRepository,
    private readonly analisisRepository: AnalisisRepository,
  ) {}

  async generarEmbeddings(req: GenerarEmbeddingsRequest = {}): Promise<GenerarEmbeddingsResult> {
    const limite = req.limite ?? 4;

    const sentencias = await this.jurisprudenciaRepository.buscarSentencias();
    const aProcesar = sentencias
      .filter((s) => s.idCodigoAcceso) // saltear anuladas
      .slice(0, limite);

    const documentos: EmbeddingDocumentoResult[] = [];

    for (const sentencia of aProcesar) {
      try {
        console.log(`[Embeddings] Procesando ${sentencia.nroRegistro} (${sentencia.idCodigoAcceso})...`);

        const doc = await this.jurisprudenciaRepository.obtenerDocumento(sentencia.idCodigoAcceso);

        const estructurada = await this.analisisRepository.resumirParaEmbedding(sentencia, doc);

        const textoEmbedding = [
          estructurada.case_type,
          estructurada.area,
          estructurada.facts,
          estructurada.decision_summary,
          estructurada.outcome,
          (estructurada.key_arguments ?? []).join(' '),
          (estructurada.keywords ?? []).join(' '),
          (estructurada.legal_issues ?? []).join(' '),
        ]
          .filter(Boolean)
          .join('\n');

        await this.embeddingsRepository.guardar({
          idCodigoAcceso: sentencia.idCodigoAcceso,
          nroRegistro: sentencia.nroRegistro,
          caratula: sentencia.caratula,
          texto: textoEmbedding || sentencia.caratula,
        });

        documentos.push({
          idCodigoAcceso: sentencia.idCodigoAcceso,
          nroRegistro: sentencia.nroRegistro,
          caratula: sentencia.caratula,
          estado: 'ok',
        });
      } catch (error) {
        console.error(`[Embeddings] Error en ${sentencia.nroRegistro}:`, error);
        documentos.push({
          idCodigoAcceso: sentencia.idCodigoAcceso,
          nroRegistro: sentencia.nroRegistro,
          caratula: sentencia.caratula,
          estado: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    return {
      procesados: documentos.filter((d) => d.estado === 'ok').length,
      errores: documentos.filter((d) => d.estado === 'error').length,
      total: aProcesar.length,
      documentos,
    };
  }

  async buscarSimilares(texto: string, topK: number = 5): Promise<SimilarityResult[]> {
    const embedding = await this.embeddingsRepository.generarEmbedding(texto);
    return this.embeddingsRepository.buscarSimilares(embedding, topK);
  }

  storeCount(): number {
    return this.embeddingsRepository.count();
  }
}
