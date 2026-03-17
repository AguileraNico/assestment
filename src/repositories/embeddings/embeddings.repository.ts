import { EmbeddingEntry, SimilarityResult } from './types';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const EMBEDDINGS_DIR = join(process.cwd(), 'data', 'embeddings');

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
    if (!existsSync(EMBEDDINGS_DIR)) return [];
    const archivos = readdirSync(EMBEDDINGS_DIR).filter((f) => f.endsWith('.json'));
    const entries = archivos.map((f) => {
      return JSON.parse(readFileSync(join(EMBEDDINGS_DIR, f), 'utf-8')) as EmbeddingEntry;
    });
    console.log(`[EmbeddingsRepository] Cargados ${entries.length} embeddings desde disco.`);
    return entries;
  } catch (e) {
    console.error('[EmbeddingsRepository] Error leyendo embeddings desde disco:', e);
    return [];
  }
}

export class EmbeddingsRepository {
  private readonly store: EmbeddingEntry[];

  constructor() {
    mkdirSync(EMBEDDINGS_DIR, { recursive: true });
    this.store = cargarStore();
  }

  private persistirEntrada(entry: EmbeddingEntry): void {
    try {
      writeFileSync(join(EMBEDDINGS_DIR, `${entry.idCodigoAcceso}.json`), JSON.stringify(entry), 'utf-8');
    } catch (e) {
      console.error(`[EmbeddingsRepository] Error guardando ${entry.idCodigoAcceso}.json:`, e);
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
      this.store[existe] = stored;
    } else {
      this.store.push(stored);
    }

    this.persistirEntrada(stored);
    return stored;
  }

  buscarSimilares(embedding: number[], topK: number = 5): SimilarityResult[] {
    return this.store
      .map((entry) => ({
        idCodigoAcceso: entry.idCodigoAcceso,
        nroRegistro: entry.nroRegistro,
        caratula: entry.caratula,
        decision: entry.decision,
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
