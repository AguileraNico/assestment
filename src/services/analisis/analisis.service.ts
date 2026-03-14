import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';
import { AnalizarConsultaRequest, AnalizarConsultaResult } from './types';

export class AnalisisService {
  constructor(
    private readonly embeddingsRepository: EmbeddingsRepository,
    private readonly analisisRepository: AnalisisRepository,
    private readonly jurisprudenciaRepository: JurisprudenciaRepository,
  ) {}

  async analizar(req: AnalizarConsultaRequest): Promise<AnalizarConsultaResult> {
    const { consulta, topK = 3 } = req;

    console.log(`[Analisis] Generando embedding para consulta...`);
    const embedding = await this.embeddingsRepository.generarEmbedding(consulta);

    console.log(`[Analisis] Buscando los ${topK} fallos más similares...`);
    const similares = this.embeddingsRepository.buscarSimilares(embedding, topK);

    console.log(`[Analisis] Fallos encontrados: ${similares.map((s) => s.nroRegistro).join(', ')}`);

    // Traer el texto completo de cada fallo para pasarlo como contexto
    const textos = await Promise.all(
      similares.map(async (s) => {
        try {
          const doc = await this.jurisprudenciaRepository.obtenerDocumento(s.idCodigoAcceso);
          return doc.texto;
        } catch {
          return '';
        }
      }),
    );

    console.log(`[Analisis] Enviando a Groq...`);
    const resultado = await this.analisisRepository.analizar(consulta, similares, textos);

    return {
      id: resultado.id,
      consulta: resultado.consulta,
      casosUsados: similares.map((s) => ({
        nroRegistro: s.nroRegistro,
        caratula: s.caratula,
        score: Math.round(s.score * 1000) / 1000,
      })),
      respuesta: resultado.respuesta,
      timestamp: resultado.timestamp,
    };
  }

  storeCount(): number {
    return this.embeddingsRepository.count();
  }
}
