import { AnalizarRequest, FiltrosBusqueda } from './types';
import { ResultadoAnalisis, BuscarSentenciasResponse, DocumentoSentencia } from '../../repositories/jurisprudencia/types';
import { JurisprudenciaRepository } from '../../repositories/jurisprudencia/jurisprudencia.repository';

export class JurisprudenciaService {
  constructor(private readonly repository: JurisprudenciaRepository) {}

  async analizar(data: AnalizarRequest): Promise<ResultadoAnalisis> {
    const registro = await this.repository.guardar(data);

    const sentencias = await this.repository.buscarSentencias({
      texoIncluido: data.texto ?? '',
    });

    const resultado = await this.procesarAnalisis(registro, sentencias);

    const actualizado = await this.repository.actualizar(registro.id, {
      estado: resultado.estado,
      parametros: { ...registro.parametros, sentencias },
    });

    return actualizado ?? registro;
  }

  async buscarSentencias(filtros: FiltrosBusqueda): Promise<BuscarSentenciasResponse> {
    return this.repository.buscarSentencias(filtros);
  }

  async obtenerDocumento(idCodigoAcceso: string): Promise<DocumentoSentencia> {
    return this.repository.obtenerDocumento(idCodigoAcceso);
  }

  private async procesarAnalisis(
    registro: ResultadoAnalisis,
    _sentencias: BuscarSentenciasResponse,
  ): Promise<ResultadoAnalisis> {
    // TODO: Implementar lógica de análisis sobre las sentencias recuperadas
    return { ...registro, estado: 'procesado' };
  }
}
