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
        const preview = texto.slice(0, 3000); // ~750 tokens por fallo
        return `--- FALLO ${i + 1}: ${caso.nroRegistro} | ${caso.caratula} (similitud: ${(caso.score * 100).toFixed(1)}%) ---\n${preview}`;
      })
      .join('\n\n');

    const prompt = `Sos un asistente jurídico especializado en jurisprudencia laboral argentina de la Suprema Corte de la Provincia de Buenos Aires (SCBA).

Se te proporciona la siguiente consulta jurídica:
"""
${consulta}
"""

Y los siguientes fallos relevantes de la SCBA como contexto:

${contexto}

Basándote exclusivamente en los fallos proporcionados, respondé:
1. ¿Qué doctrina o criterio predomina en estos fallos respecto a la consulta?
2. ¿Hay posiciones disidentes o evolución en la doctrina?
3. ¿Cómo aplicarías estos precedentes al caso consultado?

Respondé de forma clara, citando los números de registro de los fallos cuando corresponda.`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
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
