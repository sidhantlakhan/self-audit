import type { Env } from '../env.ts';
import { mockAnalysis } from './mock.ts';

export interface AnalysisInput {
  context: Record<string, string | string[] | null>;
  readiness: {
    overallScore: number;
    band: string;
    dimensions: { id: string; label: string; score: number; weightPercent: number }[];
    weakestAnswers: { question: string; score: number }[];
  };
  indicators: {
    founderDependency: { level: string; signals: string[] };
    opportunity: { level: string; areas: { area: string; strength: string; basis: string[] }[]; priorityOutcomes: string[]; expectations: string[] };
    aiAdoptionIntent: { rating: number | null; label: string };
  };
  responses: { id: string; dimension: string; question: string; answer: string | number | string[] | null }[];
}

export interface AiRequest { system: string; user: string; input: AnalysisInput }
export interface AiProvider { name: string; model: string; generate(req: AiRequest): Promise<string> }

export class AiError extends Error {
  constructor(message: string, public retryable = true) { super(message); }
}

function anthropicProvider(env: Env): AiProvider {
  return {
    name: 'anthropic',
    model: env.AI_MODEL,
    async generate({ system, user }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.AI_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: env.AI_MODEL, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
      });
      // Provider response bodies are never logged or stored — only the status class.
      if (!res.ok) throw new AiError(`AI provider returned HTTP ${res.status}`, res.status >= 500 || res.status === 429);
      const body = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = body.content?.filter((c) => c.type === 'text').map((c) => c.text).join('') ?? '';
      if (!text) throw new AiError('AI provider returned an empty response');
      return text;
    },
  };
}

/** Development/test provider: deterministic, offline, passes through the same schema and guardrails as a real model. */
function mockProvider(): AiProvider {
  return { name: 'mock', model: 'mock-v1', async generate({ input }) { return JSON.stringify(mockAnalysis(input)); } };
}

export function createAiProvider(env: Env): AiProvider {
  return env.AI_PROVIDER === 'anthropic' ? anthropicProvider(env) : mockProvider();
}
