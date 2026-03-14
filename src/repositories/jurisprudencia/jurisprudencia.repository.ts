import { randomUUID } from 'crypto';
import { ResultadoAnalisis } from './types';
import { AnalizarRequest } from '../../services/jurisprudencia/types';

export class JurisprudenciaRepository {
  // Almacenamiento en memoria — reemplazar por DB real
  private readonly store: Map<string, ResultadoAnalisis> = new Map();

  async guardar(data: AnalizarRequest): Promise<ResultadoAnalisis> {
    const registro: ResultadoAnalisis = {
      id: randomUUID(),
      texto: data.texto ?? null,
      caso: data.caso ?? null,
      parametros: data.parametros ?? {},
      estado: 'pendiente',
      timestamp: new Date().toISOString(),
    };

    this.store.set(registro.id, registro);
    return registro;
  }

  async buscarPorId(id: string): Promise<ResultadoAnalisis | null> {
    return this.store.get(id) ?? null;
  }

  async actualizar(id: string, cambios: Partial<ResultadoAnalisis>): Promise<ResultadoAnalisis | null> {
    const existente = this.store.get(id);
    if (!existente) return null;

    const actualizado = { ...existente, ...cambios };
    this.store.set(id, actualizado);
    return actualizado;
  }
}
