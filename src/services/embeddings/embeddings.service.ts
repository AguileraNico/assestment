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
  GenerarEmbeddingsRequest,
  GenerarEmbeddingsResult,
  BuscarPorConsultaRequest,
  BuscarPorConsultaResult,
  ResultadoBusqueda,
} from './types';
import {
  DocumentoSCBA,
  EmbeddingIndice,
  EmbeddingSubindice,
  RegistroSCBA,
} from '../../repositories/embeddings/types';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import Groq from 'groq-sdk';

const SENTENCIAS_CACHE_DIR = join(process.cwd(), 'data', 'sentencias');

export class EmbeddingsService {
  private readonly groqClient: Groq | null;
  private readonly modelHechos = 'llama-3.1-8b-instant';

  constructor(private readonly embeddingsRepository: EmbeddingsRepository) {
    this.groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
  }

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
        const rag = await this.generarDocumentoRAG(registro, documento);

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

  private async generarDocumentoRAG(
    registro: RegistroSCBA,
    documento: DocumentoSCBA,
  ): Promise<DocumentoRAG> {
    const base = this.generarDocumentoRAGExtractivo(registro, documento);

    if (!this.groqClient) {
      return {
        ...base,
        hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
      };
    }

    try {
      const fuente = this.extraerBloqueFactualParaLLM(documento);
      const completion = await this.groqClient.chat.completions.create({
        model: this.modelHechos,
        temperature: 0,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content:
              'Extrae hechos juridicos laborales en JSON valido, sin markdown, sin inferencias ni lenguaje procesal. Si un dato no surge, usa "No surge".',
          },
          {
            role: 'user',
            content:
              `Del texto, devolve SOLO este JSON con claves exactas: {"que_paso":"","evento":"","contexto":"","actores":"","consecuencia":"","controversia":"","explicacion":""}.\n\nReglas:\n- que_paso: 1 frase (max 25 palabras), debe responder literalmente que ocurrio.\n- explicacion: 80-160 palabras, centrada en hechos del caso, sin articulos de ley ni formula judicial.\n- no inventar datos ni completar vacios con supuestos.\n- si falta informacion, usar "No surge".\n\nTexto fuente:\n${fuente}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content ?? '';
      const hechos = this.parsearHechosEstructurados(raw);

      if (!hechos) {
        return {
          ...base,
          hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
        };
      }

      return {
        ...base,
        antecedentes: hechos.explicacion || base.antecedentes,
        hechos_estructurados: this.normalizarHechosEstructurados(hechos),
      };
    } catch (error) {
      console.error('[EmbeddingsService] Error en extraccion Groq, usando fallback extractivo:', error);
      return {
        ...base,
        hechos_estructurados: this.fallbackHechosEstructurados(base.antecedentes),
      };
    }
  }

  async generarEmbeddings(request: GenerarEmbeddingsRequest = {}): Promise<GenerarEmbeddingsResult> {
    const { limite = 100 } = request;

    if (!existsSync(SENTENCIAS_CACHE_DIR)) {
      return { totalDisponibles: 0, procesados: 0, errores: 0 };
    }

    const archivos = readdirSync(SENTENCIAS_CACHE_DIR)
      .filter((f) => f.endsWith('.json'))
      .slice(0, limite);

    let procesados = 0;
    let errores = 0;

    for (const archivo of archivos) {
      try {
        const cachePath = join(SENTENCIAS_CACHE_DIR, archivo);
        const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as DocumentoProcesadoCache;

        const textoBase = this.construirTextoParaEmbedding(cached);
        const { demandante, demandado, tipo_causa } = this.parsearCaratula(cached.caratula);
        const resultado_causa = this.detectarGanador(cached.sentencia || '');
        const indice = this.clasificarIndice(cached.caratula, cached.hechos_estructurados?.que_paso, tipo_causa);
        const subindice = this.clasificarSubindice(
          indice,
          cached.caratula,
          cached.hechos_estructurados?.que_paso,
          tipo_causa,
          cached.sentencia,
        );

        await this.embeddingsRepository.guardar({
          idCodigoAcceso: cached.idCodigoAcceso,
          nroRegistro: cached.nroRegistro,
          caratula: cached.caratula,
          indice,
          subindice,
          demandante,
          demandado,
          tipoCausa: tipo_causa,
          quePaso: cached.hechos_estructurados?.que_paso ?? 'No disponible',
          resultadoCausa: resultado_causa,
          hechosExplicacion: cached.hechos_estructurados?.explicacion ?? cached.antecedentes,
          decision: cached.sentencia,
          texto: textoBase,
        });

        procesados += 1;
      } catch (error) {
        console.error(`[EmbeddingsService] Error generando embedding para ${archivo}:`, error);
        errores += 1;
      }
    }

    return {
      totalDisponibles: archivos.length,
      procesados,
      errores,
    };
  }

  async buscarPorConsulta(request: BuscarPorConsultaRequest): Promise<BuscarPorConsultaResult> {
    const { consulta, topK = 5, generarRespuesta = false, indice, subindice } = request;

    if (!consulta || consulta.trim().length === 0) {
      return { consulta, resultados: [], totalEncontrados: 0 };
    }

    try {
      const queryEmbedding = await this.embeddingsRepository.generarEmbedding(consulta);
      const indiceUsado = indice ?? this.inferirIndiceConsulta(consulta);
      const subindiceUsado = subindice ?? this.inferirSubindiceConsulta(consulta, indiceUsado);
      const candidatos = this.embeddingsRepository.buscarSimilares(
        queryEmbedding,
        Math.max(topK * 6, 20),
        indiceUsado,
        subindiceUsado,
      );
      const consultaNorm = this.normalizarTexto(this.aColoquial(consulta));

      const resultados: ResultadoBusqueda[] = candidatos
        .map((r) => {
          const scoreBase = r.score;
          const { demandante, demandado, tipo_causa } = this.parsearCaratula(r.caratula);
          const resultado_causa = r.resultadoCausa || this.detectarGanador(r.decision ?? '');
          const que_paso = r.quePaso ?? 'No disponible';
          const textoCaso = this.normalizarTexto(
            `${r.caratula} ${r.tipoCausa ?? tipo_causa} ${que_paso} ${resultado_causa}`,
          );
          const scoreAjustado = this.ajustarScorePorIntencion(consultaNorm, textoCaso, scoreBase);
          const score = Math.round(scoreAjustado * 1000) / 1000;

          return {
            idCodigoAcceso: r.idCodigoAcceso,
            nroRegistro: r.nroRegistro,
            caratula: this.caratulaColoquial(r.caratula),
            indice: r.indice,
            subindice: r.subindice,
            demandante: r.demandante ?? demandante,
            demandado: r.demandado ?? demandado,
            tipo_causa: this.aColoquial(r.tipoCausa ?? tipo_causa),
            que_paso: this.aColoquial(que_paso),
            resultado_causa: this.aColoquial(resultado_causa),
            score,
            relevancia: this.calcularRelevancia(score),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      const respuesta = generarRespuesta
        ? await this.generarRespuestaDesdeContexto(consulta, resultados)
        : undefined;

      return {
        consulta,
        indiceUsado,
        subindiceUsado,
        resultados,
        totalEncontrados: resultados.length,
        respuesta,
      };
    } catch (error) {
      console.error('[EmbeddingsService] Error en búsqueda semántica:', error);
      return { consulta, resultados: [], totalEncontrados: 0 };
    }
  }

  private async generarRespuestaDesdeContexto(
    consulta: string,
    resultados: ResultadoBusqueda[],
  ): Promise<string> {
    if (resultados.length === 0) {
      return 'No se encontraron precedentes relevantes para elaborar una respuesta.';
    }

    if (!this.groqClient) {
      const top = resultados.slice(0, 3);
      const resumen = top
        .map(
          (r, i) =>
            `${i + 1}) ${r.demandante} contra ${r.demandado} (${this.aColoquial(r.tipo_causa)}) - score ${r.score}. Que paso: ${this.aColoquial(r.que_paso)}`,
        )
        .join(' ');
      return `Resumen preliminar para "${consulta}": ${resumen}`;
    }

    try {
      const contexto = resultados
        .slice(0, 5)
        .map(
          (r, i) =>
            `Caso ${i + 1}: actor=${r.demandante}; demandado=${r.demandado}; tipo_en_lenguaje_simple=${this.aColoquial(r.tipo_causa)}; que_paso=${this.aColoquial(r.que_paso)}; resultado=${this.aColoquial(r.resultado_causa)}; score=${r.score}`,
        )
        .join('\n');

      const completion = await this.groqClient.chat.completions.create({
        model: this.modelHechos,
        temperature: 0.2,
        max_tokens: 260,
        messages: [
          {
            role: 'system',
            content:
              'Sos un asistente que explica casos laborales en lenguaje comun de Argentina. Regla obligatoria: no uses terminologia legal ni tecnicismos. Prohibido decir "in itinere", "accion especial", "actor", "demandado" o "caratula". En su lugar usa frases simples como "mientras iba o volvia del trabajo" y "la persona que inicio el reclamo".',
          },
          {
            role: 'user',
            content:
              `Consulta del usuario: ${this.aColoquial(consulta)}\n\nContexto de casos:\n${contexto}\n\nEscribe una respuesta breve (90-130 palabras), clara y coloquial, incluyendo: 1) quien le reclama a quien; 2) que ocurrio; 3) como vienen los resultados (si suele favorecer a quien reclama, a la empresa/ART, o no se puede saber); 4) que tan buena es la coincidencia segun scores (alta/media/baja). No uses jerga legal ni latinismos.`,
          },
        ],
      });

      const respuesta = completion.choices?.[0]?.message?.content?.trim();
      if (!respuesta) {
        return 'No fue posible generar respuesta enriquecida con IA para esta consulta.';
      }
      return respuesta;
    } catch (error) {
      console.error('[EmbeddingsService] Error generando respuesta con Groq:', error);
      return 'No fue posible generar respuesta enriquecida con IA en este momento.';
    }
  }

  private aColoquial(texto: string): string {
    return texto
      .replace(/\bin itinere\b/gi, 'mientras iba o volvia del trabajo')
      .replace(/\baccion especial\b/gi, 'reclamo por accidente laboral')
      .replace(/\baccidente de trabajo\b/gi, 'accidente en el trabajo')
      .replace(/\benfermedad profesional\b/gi, 'problema de salud causado por el trabajo')
      .replace(/\bart\b/gi, 'aseguradora de riesgos del trabajo')
      .replace(/\bdemanda\b/gi, 'reclamo')
      .replace(/\bactor\b/gi, 'persona que reclama')
      .replace(/\bactora\b/gi, 'persona que reclama')
      .replace(/\bdemandado\b/gi, 'parte reclamada')
      .replace(/\bdemandada\b/gi, 'parte reclamada')
      .replace(/\bcaratula\b/gi, 'titulo del caso')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parsearCaratula(caratula: string): { demandante: string; demandado: string; tipo_causa: string } {
    // Format: "APELLIDO NOMBRE C/ EMPRESA S/ TIPO CAUSA"
    const matchC = caratula.match(/^(.+?)\s+[Cc]\/\s*(.+?)\s+[Ss]\/\s*(.+)$/);
    if (matchC) {
      return {
        demandante: matchC[1].trim(),
        demandado: matchC[2].trim(),
        tipo_causa: matchC[3].replace(/^\*/, '').trim(),
      };
    }
    return { demandante: caratula, demandado: 'No identificado', tipo_causa: 'No identificado' };
  }

  private detectarGanador(sentencia: string): string {
    if (!sentencia) return 'No determinado';
    const lower = sentencia.toLowerCase();

    // Buscar en el último tramo del texto donde suele estar la parte dispositiva
    const fragmento = lower.slice(-1500);

    if (/rechaz[ao]\s+(la\s+)?demanda|sin\s+lugar\s+la\s+demanda|absuelv/.test(fragmento)) {
      return 'La parte reclamada salió favorecida (se rechazó el reclamo)';
    }
    if (/hace\s+lugar|hago\s+lugar|haciendo\s+lugar|condena\s+a\s+la\s+demandad|condena\s+al\s+demandad|se\s+admite\s+la\s+demanda|lugar\s+a\s+la\s+acción/.test(fragmento)) {
      return 'La persona que reclamó salió favorecida';
    }
    if (/parcialmente|en\s+parte/.test(fragmento)) {
      return 'Resultado intermedio (parcial)';
    }
    return 'No determinado';
  }

  private caratulaColoquial(caratula: string): string {
    return this.aColoquial(
      caratula
        .replace(/\s+[Cc]\//g, ' contra ')
        .replace(/\s+[Ss]\//g, ' por '),
    );
  }

  private clasificarIndice(
    caratula: string,
    quePaso?: string,
    tipoCausa?: string,
  ): EmbeddingIndice {
    const texto = this.normalizarTexto(`${caratula} ${tipoCausa ?? ''} ${quePaso ?? ''}`);

    if (/despido|despedido|indemnizacion|extincion del contrato/.test(texto)) {
      return 'despidos';
    }
    if (/enfermedad|artritis|dolencia|patologia|salud causado por el trabajo/.test(texto)) {
      return 'enfermedades';
    }
    if (
      /in[-\s]?itinere|mientras iba o volvia del trabajo|trayecto|camino al trabajo|camino de regreso|domicilio/.test(
        texto,
      )
    ) {
      return 'accidentes_trayecto';
    }
    if (/accidente|lesion|fractura|incapacidad|durante sus tareas|en el trabajo/.test(texto)) {
      return 'accidentes_trabajo';
    }
    return 'otros';
  }

  private clasificarSubindice(
    indice: EmbeddingIndice,
    caratula: string,
    quePaso?: string,
    tipoCausa?: string,
    sentencia?: string,
  ): EmbeddingSubindice {
    const texto = this.normalizarTexto(
      `${caratula} ${tipoCausa ?? ''} ${quePaso ?? ''} ${sentencia ?? ''}`,
    );

    if (indice === 'despidos') {
      if (/conciliacion|homologo|homologacion|desistimiento/.test(texto)) return 'despido_conciliacion';
      if (/no registrado|registracion|fecha de ingreso|categoria|deficiente registracion/.test(texto)) {
        return 'despido_registracion';
      }
      if (/enfermedad|artritis|patologia|dolencia|medico|salud/.test(texto)) return 'despido_enfermedad';
      return 'despido_general';
    }

    if (indice === 'enfermedades') {
      if (/conciliacion|homologo|homologacion|desistimiento|liquidaron/.test(texto)) {
        return 'enfermedad_procesal';
      }
      if (/profesional/.test(texto)) return 'enfermedad_profesional';
      return 'enfermedad_accidente';
    }

    if (indice === 'accidentes_trayecto') return 'trayecto_general';
    if (indice === 'accidentes_trabajo') return 'trabajo_general';
    return 'otro';
  }

  private inferirIndiceConsulta(consulta: string): EmbeddingIndice | undefined {
    const texto = this.normalizarTexto(this.aColoquial(consulta));

    if (/despido|despedido|echaron|indemnizacion/.test(texto)) {
      return 'despidos';
    }
    if (/enfermedad|patologia|salud|dolencia/.test(texto)) {
      return 'enfermedades';
    }
    if (/yendo|volviendo|trayecto|camino al trabajo|camino de regreso|domicilio|casa/.test(texto)) {
      return 'accidentes_trayecto';
    }
    if (/accidente|lesion|fractura|incapacidad|aseguradora/.test(texto)) {
      return 'accidentes_trabajo';
    }
    return undefined;
  }

  private inferirSubindiceConsulta(
    consulta: string,
    indice?: EmbeddingIndice,
  ): EmbeddingSubindice | undefined {
    const texto = this.normalizarTexto(this.aColoquial(consulta));

    if (indice === 'despidos') {
      if (/enfermedad|patologia|salud|dolencia/.test(texto)) return 'despido_enfermedad';
      if (/registrado|registracion|en negro|fecha de ingreso|categoria/.test(texto)) {
        return 'despido_registracion';
      }
      return 'despido_general';
    }

    if (indice === 'enfermedades') {
      if (/profesional/.test(texto)) return 'enfermedad_profesional';
      return 'enfermedad_accidente';
    }

    if (indice === 'accidentes_trayecto') return 'trayecto_general';
    if (indice === 'accidentes_trabajo') return 'trabajo_general';
    return undefined;
  }

  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private ajustarScorePorIntencion(consulta: string, textoCaso: string, scoreBase: number): number {
    let score = scoreBase;

    const consultaTrayecto =
      /(yendo|volviendo|trayecto|camino|ida|vuelta|domicilio|casa|in[-\s]?itinere)/.test(consulta);
    const consultaLugarTrabajo =
      /(mientras trabajaba|trabajando|en el trabajo|durante sus tareas|en su puesto|jornada laboral)/.test(
        consulta,
      );
    const casoTrayecto =
      /(yendo|volviendo|trayecto|domicilio|casa|mientras iba o volvia del trabajo|in[-\s]?itinere)/.test(
        textoCaso,
      );
    const casoLugarTrabajo =
      /(accidente en el trabajo|contexto laboral|lugar de trabajo|durante sus tareas|en su puesto)/.test(
        textoCaso,
      );
    const casoProcesal = /(conciliacion|homologacion|homologo|desistimiento|liquidaron)/.test(textoCaso);
    const consultaDespido = /(despido|despedido|echaron)/.test(consulta);
    const consultaEnfermedad = /(enfermedad|patologia|dolencia|salud)/.test(consulta);

    if (consultaTrayecto) {
      if (casoTrayecto) score += 0.12;
      if (!casoTrayecto) score -= 0.25;
      if (!casoTrayecto && casoLugarTrabajo) score -= 0.1;
    }

    if (consultaLugarTrabajo) {
      if (casoLugarTrabajo) score += 0.08;
      if (casoTrayecto) score -= 0.22;
    }

    if ((consultaDespido || consultaEnfermedad) && casoProcesal) {
      score -= 0.2;
    }

    if (score < 0) return 0;
    if (score > 1) return 1;
    return score;
  }

  private calcularRelevancia(score: number): 'alta' | 'media' | 'baja' {
    if (score >= 0.6) return 'alta';
    if (score >= 0.45) return 'media';
    return 'baja';
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

  private construirTextoParaEmbedding(doc: DocumentoRAG): string {
    // Embedding solo con hechos para maximizar similitud semantica por "que paso"
    const explicacion = doc.hechos_estructurados?.explicacion?.trim() || '';
    return (explicacion || doc.antecedentes || '').trim();
  }

  private parsearHechosEstructurados(raw: string): DocumentoRAG['hechos_estructurados'] | null {
    const trimmed = raw.trim();
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch?.[0];
    if (!jsonText) return null;

    try {
      const obj = JSON.parse(jsonText) as Record<string, unknown>;
      const get = (k: string): string => {
        const v = obj[k];
        if (typeof v !== 'string') return 'No surge';
        const s = v.replace(/\s+/g, ' ').trim();
        return s || 'No surge';
      };

      return {
        que_paso: get('que_paso'),
        evento: get('evento'),
        contexto: get('contexto'),
        actores: get('actores'),
        consecuencia: get('consecuencia'),
        controversia: get('controversia'),
        explicacion: get('explicacion'),
      };
    } catch {
      return null;
    }
  }

  private fallbackHechosEstructurados(antecedentes: string): NonNullable<DocumentoRAG['hechos_estructurados']> {
    const limpio = this.extraerExplicacionFallback(antecedentes);
    const lower = limpio.toLowerCase();
    const detectar = (re: RegExp): boolean => re.test(lower);

    const evento = detectar(/accidente|infortunio|lesion|lesi[oó]n/)
      ? 'Accidente laboral'
      : detectar(/despido|desvincul|distracto/)
      ? 'Despido'
      : detectar(/enfermedad|patolog/i)
      ? 'Enfermedad laboral'
      : 'No surge';

    const contexto = detectar(/in itinere|trayecto|domicilio|trabajo|moto|motocicleta|veh[ií]culo/)
      ? 'Traslado o contexto laboral'
      : 'No surge';

    const consecuencia = detectar(/incapacidad|da[nñ]o|lesi[oó]n|indemnizaci[oó]n/)
      ? 'Se reclaman consecuencias laborales o resarcitorias'
      : 'No surge';

    const controversia = detectar(/rechaza|rechazo|responsabilidad|cobertura|justificad|legitim/)
      ? 'Se discute la procedencia del reclamo o la responsabilidad'
      : 'No surge';

    return this.normalizarHechosEstructurados({
      que_paso: evento !== 'No surge' ? `${evento} en contexto laboral` : 'No surge',
      evento,
      contexto,
      actores: 'No surge',
      consecuencia,
      controversia,
      explicacion: limpio || 'No surge del texto',
    });
  }

  private normalizarHechosEstructurados(
    hechos: NonNullable<DocumentoRAG['hechos_estructurados']>,
  ): NonNullable<DocumentoRAG['hechos_estructurados']> {
    const limpiar = (s: string): string =>
      (s || '')
        .replace(/\s+/g, ' ')
        .replace(/^(se\s+re[uú]nen\s+los\s+jueces[^.]*\.?)/i, '')
        .trim();

    const explicacion = limpiar(hechos.explicacion) || 'No surge';
    let quePaso = limpiar(hechos.que_paso);

    const esProcesal = /(jueces|tribunal|dictar|veredicto|sentencia)/i.test(quePaso);
    if (!quePaso || quePaso === 'No surge' || esProcesal) {
      const oraciones = explicacion.split(/(?<=[.!?])\s+/).map((s) => s.trim());
      const factual = oraciones.find((s) =>
        /(trabajador|trabajadora|actor|actora|reclama|demanda|accidente|despido|lesi[oó]n|incapacidad|empresa|empleador)/i.test(
          s,
        ),
      );
      quePaso = (factual || oraciones[0] || 'No surge').slice(0, 180).trim();
    }

    return {
      ...hechos,
      que_paso: quePaso || 'No surge',
      explicacion,
    };
  }

  private extraerBloqueFactualParaLLM(documento: DocumentoSCBA): string {
    const fuentePrimaria =
      documento.secciones.antecedentes_y_objeto || documento.hechos || documento.textoCompleto || '';

    const texto = fuentePrimaria
      .replace(/\s+/g, ' ')
      .replace(/(AUTOS Y VISTOS|VISTOS|SENTENCIA|VEREDICTO|CUESTIONES)\b/gi, ' ')
      .trim();

    const oraciones = texto
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40);

    const clavesFacticas =
      /(trabajador|trabajadora|actor|actora|demanda|reclama|accidente|trayecto|in itinere|moto|lesi[oó]n|incapacidad|despido|empresa|empleador|art|afip|telegrama|intim[oó]|rechaz[oó]|cobertura)/i;

    const seleccion = oraciones.filter((s) => clavesFacticas.test(s)).slice(0, 18);
    const base = (seleccion.length ? seleccion : oraciones.slice(0, 18)).join(' ');
    return base.slice(0, 3600);
  }

  private extraerExplicacionFallback(texto: string): string {
    const sinSaltos = (texto || '').replace(/\s+/g, ' ').trim();
    if (!sinSaltos) return 'No surge del texto';

    // Quitar marcadores procesales frecuentes que meten ruido
    const limpio = sinSaltos
      .replace(/Organismo:\s*[^.]+\.?/gi, ' ')
      .replace(/Causa:\s*[^.]+\.?/gi, ' ')
      .replace(/N[uú]mero:\s*[^.]+\.?/gi, ' ')
      .replace(/(VISTOS|AUTOS Y VISTOS|SENTENCIA|VEREDICTO|CUESTIONES)\b/gi, ' ')
      .replace(/art[íi]?culo\s+\d+[\w\s.,°º-]*/gi, ' ')
      .replace(/arts?\.\s*[\d.,\s]+[\w\s.,°º-]*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Seleccionar oraciones con contenido factual
    const oraciones = limpio
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30);

    const relevantes = oraciones.filter((s) =>
      /(trabajador|actora|actor|demanda|reclama|accidente|despido|lesi[oó]n|incapacidad|art|empresa|empleador|trayecto|moto|laboral)/i.test(
        s,
      ),
    );

    const base = (relevantes.length ? relevantes : oraciones).slice(0, 5).join(' ');
    return base.slice(0, 900).trim() || 'No surge del texto';
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
