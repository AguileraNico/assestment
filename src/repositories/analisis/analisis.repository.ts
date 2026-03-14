import Groq from 'groq-sdk';
import { SimilarityResult } from '../embeddings/types';
import { AnalisisEntry } from './types';
import { randomUUID } from 'crypto';

export class AnalisisRepository {
  private readonly client: Groq;
  private readonly model = 'llama-3.3-70b-versatile';

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async analizar(consulta: string, casos: SimilarityResult[], textosCasos: string[]): Promise<AnalisisEntry> {
    const contexto = casos
      .map((caso, i) => {
        const texto = textosCasos[i] ?? '';
        const preview = texto.slice(0, 3000);
        return `--- PRECEDENTE ${i + 1}: ${caso.nroRegistro} | Similitud: ${(caso.score * 100).toFixed(1)}% ---\nCarátula: ${caso.caratula}\n\nTexto del fallo:\n${preview}`;
      })
      .join('\n\n');

    const systemPrompt = `Sos un asistente de investigación jurídica especializado en jurisprudencia laboral de la Suprema Corte de la Provincia de Buenos Aires (SCBA).
Tu rol es ayudar a abogados laboralistas a encontrar y utilizar precedentes relevantes para sus casos.
Cuando recibas un caso y fallos de referencia, analizá los precedentes y respondé siempre con esta estructura:

1. **Cómo se resolvió cada caso similar**: Para cada fallo, explicá brevemente el resultado (si el trabajador ganó o perdió, qué se resolvió) y citá su número de registro.
2. **Doctrina que surge de estos fallos**: ¿Qué criterio o principio jurídico aplicó la SCBA de forma consistente? ¿Hay evolución o cambios en la postura del tribunal?
3. **Cómo usarlos como precedente**: ¿Qué argumentos concretos puede esgrimir el abogado basándose en estos fallos? ¿Qué aspectos del caso actual son análogos a los precedentes encontrados?

Citá siempre el número de registro (ej: RS-18-2026) cuando menciones un fallo específico. Respondé en español, de forma clara y accionable para un abogado.`;

    const userPrompt = `El abogado está estudiando el siguiente caso:
"""
${consulta}
"""

Se encontraron los siguientes fallos de la SCBA como precedentes relevantes:

${contexto}

Analizá estos precedentes y respondé con las tres secciones indicadas.`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const respuesta = completion.choices[0]?.message?.content ?? 'Sin respuesta';

    return {
      id: randomUUID(),
      consulta,
      contextoCasos: casos,
      respuesta,
      timestamp: new Date().toISOString(),
    };
  }
}
