import { AnalizarRequest } from './types';
import { ResultadoAnalisis } from '../../repositories/jurisprudencia/types';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';

export class JurisprudenciaService {
  constructor(private readonly repository: JurisprudenciaRepository) {}

  async analizar(data: AnalizarRequest): Promise<ResultadoAnalisis> {
    // Persistir el registro inicial
    const registro = await this.repository.guardar(data);

    // TODO: Implementar lógica de análisis (ej: llamada a modelo de IA, reglas, etc.)
    const resultado = await this.procesarAnalisis(registro);

    // Actualizar estado tras el procesamiento
    const actualizado = await this.repository.actualizar(registro.id, {
      estado: resultado.estado,
    });

    return actualizado ?? registro;
  }

  private async procesarAnalisis(registro: ResultadoAnalisis): Promise<ResultadoAnalisis> {
    // TODO: Reemplazar con lógica real
    return {
      ...registro,
      estado: 'procesado',
    };
  }
}
