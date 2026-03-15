import Groq from 'groq-sdk';
import { SimilarityResult } from '../embeddings/types';
import { AnalisisEntry, AnalisisRespuesta, SentenciaEstructurada } from './types';
import { DocumentoSentencia, SentenciaItem } from '../jurisprudencia/types';
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'data', 'sentencias');

function leerCache(idCodigoAcceso: string): SentenciaEstructurada | null {
  const filePath = join(CACHE_DIR, `${idCodigoAcceso}.json`);
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8')) as SentenciaEstructurada;
    } catch {
      return null;
    }
  }
  return null;
}

function escribirCache(idCodigoAcceso: string, data: SentenciaEstructurada): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${idCodigoAcceso}.json`), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[AnalisisRepository] Error guardando cache ${idCodigoAcceso}:`, e);
  }
}

export class AnalisisRepository {
  private readonly client: Groq;
  private readonly model = 'llama-3.3-70b-versatile';

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async resumirParaEmbedding(sentencia: SentenciaItem, doc: DocumentoSentencia): Promise<SentenciaEstructurada> {
    const cached = leerCache(sentencia.idCodigoAcceso);
    if (cached) {
      console.log(`[AnalisisRepository] Cache hit: ${sentencia.nroRegistro}`);
      return cached;
    }

    console.log(`[AnalisisRepository] Llamando a Groq para: ${sentencia.nroRegistro}`);
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Extrae información estructurada de sentencias judiciales argentinas.
Devuelve únicamente JSON válido siguiendo exactamente el esquema indicado.
Si un campo no aparece, devuelve null.

Esquema esperado:
{
  "case_name": "",
  "case_number": "",
  "court": "",
  "area": "",
  "date": "",
  "parties": { "plaintiff": "", "defendants": [] },
  "case_type": "",
  "facts": "",
  "legal_issues": [],
  "laws_cited": [],
  "precedents_cited": [],
  "decision_summary": "",
  "outcome": "",
  "damages_or_compensation": "",
  "key_arguments": [],
  "keywords": []
}`,
        },
        {
          role: 'user',
          content: `Extrae la información estructurada de la siguiente sentencia y devólvela en JSON.

SENTENCIA:
${doc.texto}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    let resultado: SentenciaEstructurada;
    try {
      resultado = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as SentenciaEstructurada;
    } catch {
      resultado = {
        case_name: sentencia.caratula,
        case_number: sentencia.nroRegistro,
        court: doc.organismo,
        area: null,
        date: sentencia.fecha,
        parties: { plaintiff: null, defendants: [] },
        case_type: null,
        facts: doc.texto.slice(0, 500),
        legal_issues: [],
        laws_cited: [],
        precedents_cited: [],
        decision_summary: null,
        outcome: null,
        damages_or_compensation: null,
        key_arguments: [],
        keywords: [],
      };
    }

    escribirCache(sentencia.idCodigoAcceso, resultado);
    return resultado;
  }

  async analizar(consulta: string, casos: SimilarityResult[], textosCasos: string[]): Promise<AnalisisEntry> {
    const contexto = casos
      .map((caso, i) => {
        const texto = textosCasos[i] ?? '';
        const preview = texto.slice(0, 3000);
        return `--- PRECEDENTE ${i + 1}: ${caso.nroRegistro} | Similitud: ${(caso.score * 100).toFixed(1)}% ---\nCarátula: ${caso.caratula}\n\nTexto del fallo:\n${preview}`;
      })
      .join('\n\n');

    const systemPrompt = `Eres un asistente jurídico especializado en analizar jurisprudencia de tribunales argentinos.

Tu tarea es ayudar a abogados a evaluar un caso comparándolo con sentencias judiciales previamente resueltas.

Recibirás:
1) la descripción de un caso
2) varias sentencias similares ya estructuradas

Debes:

- identificar similitudes entre el caso y las sentencias
- explicar cómo resolvieron los tribunales esos casos
- detectar factores favorables y riesgos del caso
- sugerir posibles argumentos jurídicos basados en la jurisprudencia

Reglas:

- utiliza únicamente la información proporcionada
- no inventes jurisprudencia
- menciona siempre las causas relevantes cuando las cites
- responde de forma clara y práctica para un abogado litigante

Devuelve SIEMPRE la respuesta en JSON con la siguiente estructura:

{
  "case_summary": "",
  "similar_cases": [
    {
      "case_name": "",
      "similarity_reason": ""
    }
  ],
  "favorable_factors": [],
  "risk_factors": [],
  "suggested_arguments": [],
  "relevant_precedents": []
}`;

    const userPrompt = `El abogado está estudiando el siguiente caso:
"""
${consulta}
"""

Se encontraron los siguientes fallos de la SCBA como precedentes relevantes:

${contexto}

Analizá estos precedentes y devolvé el JSON con la estructura indicada.`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    let respuesta: AnalisisRespuesta;
    try {
      respuesta = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as AnalisisRespuesta;
    } catch {
      respuesta = {
        case_summary: '',
        similar_cases: [],
        favorable_factors: [],
        risk_factors: [],
        suggested_arguments: [],
        relevant_precedents: [completion.choices[0]?.message?.content ?? 'Sin respuesta'],
      };
    }

    return {
      id: randomUUID(),
      consulta,
      contextoCasos: casos,
      respuesta,
      timestamp: new Date().toISOString(),
    };
  }
}
