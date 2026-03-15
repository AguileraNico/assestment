import { EmbeddingEntry, SimilarityResult } from './types';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORE_PATH = join(process.cwd(), 'data', 'embeddings.json');

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

function cargarStore(): EmbeddingEntry[] {
  try {
    if (existsSync(STORE_PATH)) {
      const entries = JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as EmbeddingEntry[];
      console.log(`[EmbeddingsRepository] Cargados ${entries.length} embeddings desde disco.`);
      return entries;
    }
  } catch (e) {
    console.error('[EmbeddingsRepository] Error leyendo embeddings.json:', e);
  }
  return [];
}

export class EmbeddingsRepository {
  private readonly store: EmbeddingEntry[];

  constructor() {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    this.store = cargarStore();
  }

  private persistir(): void {
    try {
      writeFileSync(STORE_PATH, JSON.stringify(this.store), 'utf-8');
    } catch (e) {
      console.error('[EmbeddingsRepository] Error guardando embeddings.json:', e);
    }
  }

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

    this.persistir();
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
