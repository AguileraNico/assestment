import { EmbeddingsRepository } from '../../repositories/embeddings/embeddings.repository';
import { AnalisisRepository } from '../../repositories/analisis/analisis.repository';
import { AnalizarConsultaRequest, AnalizarConsultaResult } from './types';

export class AnalisisService {
  constructor(
    private readonly embeddingsRepository: EmbeddingsRepository,
    private readonly analisisRepository: AnalisisRepository,
  ) {}

  async analizar(req: AnalizarConsultaRequest): Promise<AnalizarConsultaResult> {
    const { consulta, topK = 3, umbralSimilitud = 0.75 } = req;

    console.log(`[Analisis] Generando embedding para consulta...`);
    const embedding = await this.embeddingsRepository.generarEmbedding(consulta);

    console.log(`[Analisis] Buscando los ${topK} fallos más similares...`);
    const similares = this.embeddingsRepository.buscarSimilares(embedding, topK);

    const relevantes = similares.filter((s) => s.score >= umbralSimilitud);

    console.log(`[Analisis] Fallos encontrados: ${similares.map((s) => `${s.nroRegistro}(${s.score.toFixed(2)})`).join(', ')}`);
    console.log(`[Analisis] Relevantes (score >= ${umbralSimilitud}): ${relevantes.length}`);

    if (relevantes.length === 0) {
      return {
        id: crypto.randomUUID(),
        consulta,
        sinCoincidencias: true,
        casosUsados: similares.map((s) => ({
          idCodigoAcceso: s.idCodigoAcceso,
          nroRegistro: s.nroRegistro,
          caratula: s.caratula,
          score: Math.round(s.score * 1000) / 1000,
        })),
        respuesta: null,
        timestamp: new Date().toISOString(),
      };
    }

    // La decisión ya está en el embedding — no hace falta fetchear SCBA de nuevo
    const textos = relevantes.map((s) => s.decision ?? '');

    console.log(`[Analisis] Enviando a Groq...`);
    const resultado = await this.analisisRepository.analizar(consulta, relevantes, textos);

    // Enriquecer similar_cases del LLM con idCodigoAcceso para que el front pueda abrir el fallo
    const idxPorRegistro = new Map(relevantes.map((s) => [s.nroRegistro, s.idCodigoAcceso]));
    if (resultado.respuesta?.similar_cases) {
      resultado.respuesta.similar_cases = resultado.respuesta.similar_cases.map((sc) => ({
        ...sc,
        idCodigoAcceso: idxPorRegistro.get(sc.case_id) ?? null,
      }));
    }

    return {
      id: resultado.id,
      consulta: resultado.consulta,
      casosUsados: relevantes.map((s) => ({
        idCodigoAcceso: s.idCodigoAcceso,
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
