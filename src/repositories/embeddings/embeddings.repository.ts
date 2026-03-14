import { EmbeddingEntry, SimilarityResult } from './types';

// Cargamos el modelo una sola vez (lazy singleton)
let embedderPromise: Promise<any> | null = null;

function getEmbedder(): Promise<any> {
  if (!embedderPromise) {
    embedderPromise = import('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'),
    );
  }
  return embedderPromise;
}

export class EmbeddingsRepository {
  // Vector store en memoria — reemplazar por Qdrant/pgvector en producción
  private readonly store: EmbeddingEntry[] = [];

  async generarEmbedding(texto: string): Promise<number[]> {
    const embedder = await getEmbedder();
    const result = await embedder(texto, { pooling: 'mean', normalize: true });
    return Array.from(result.data as Float32Array);
  }

  async guardar(entry: Omit<EmbeddingEntry, 'embedding'> & { texto: string }): Promise<EmbeddingEntry> {
    const { texto, ...meta } = entry;

    // Evitar duplicados por idCodigoAcceso
    const existe = this.store.findIndex((e) => e.idCodigoAcceso === meta.idCodigoAcceso);

    const embedding = await this.generarEmbedding(texto);
    const stored: EmbeddingEntry = { ...meta, embedding };

    if (existe >= 0) {
      this.store[existe] = stored; // actualizar
    } else {
      this.store.push(stored);    // insertar
    }

    return stored;
  }

  buscarSimilares(embedding: number[], topK: number = 5): SimilarityResult[] {
    return this.store
      .map((entry) => ({
        idCodigoAcceso: entry.idCodigoAcceso,
        nroRegistro: entry.nroRegistro,
        caratula: entry.caratula,
        score: this.cosineSimilarity(embedding, entry.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  count(): number {
    return this.store.length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return normA && normB ? dot / (normA * normB) : 0;
  }
}
