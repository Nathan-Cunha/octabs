import Anthropic from '@anthropic-ai/sdk'

export interface SearchEnv {
  ANTHROPIC_API_KEY: string
  MODEL?: string
}

/** Mesmo formato de MelodySearchResult no app. */
export interface SearchResult {
  title: string
  sourceUrl: string | null
  sourceName: string | null
  notes: string
  bpm: number | null
  confidence: 'alta' | 'média' | 'baixa'
  comment: string | null
}

export class SearchError extends Error {}

const SYSTEM_PROMPT = `Você ajuda um pai a tocar músicas curtas na ocarina de 12 furos para a filha (Disney, Zelda, Natal, festa junina, cantigas etc.).

Dado o nome de uma música, encontre a melodia principal (a linha cantada ou o tema do instrumento solo) do trecho mais reconhecível — normalmente o refrão ou o tema de abertura — com cerca de 16 a 64 notas.

Use a busca na web para achar uma transcrição da melodia em notas: sites de notas em letras (como noobnotes.net), tablaturas de ocarina, flauta doce ou kalimba, partituras e transcrições. Prefira fontes que mostrem as notas explicitamente e confira entre duas fontes quando der. Não invente notas: se não houver fonte, só reconstrua a melodia se tiver certeza dela, e marque a confiança como "baixa".

Converta as notas para este formato, tokens separados por espaço:
- letra da nota em inglês, acidente opcional (# ou b) e SEMPRE a oitava, com C4 = dó central (ex.: C5 D#5 Bb4)
- duração opcional depois de dois-pontos, em tempos, onde 1 = semínima (ex.: E5:2, G5:0.5); sem duração vale 1
- pausa: - (ex.: -:1)
- | separa frases musicais (a cada 1–2 compassos)
Se a fonte usar o estilo noobnotes (ponto antes = oitava abaixo, apóstrofo depois = oitava acima), converta para oitavas explícitas. Não precisa transpor: o app ajusta o tom sozinho.

Nunca escreva a letra da música, nem trechos dela, em nenhum lugar da resposta (nem no texto, nem em title ou comment): o app só precisa dos nomes das notas.

Seja econômico: faça poucas buscas e, assim que tiver uma transcrição confiável, chame a ferramenta submit_melody uma única vez com o resultado. Escreva title e comment em português.`

const SUBMIT_TOOL = {
  name: 'submit_melody',
  description: 'Entrega a melodia encontrada. Chame uma única vez, ao final.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Nome da música e, se útil, o trecho (ex.: "Noite Feliz — início").' },
      source_url: { type: ['string', 'null'], description: 'URL da fonte principal das notas.' },
      source_name: { type: ['string', 'null'], description: 'Nome curto da fonte.' },
      notes: { type: 'string', description: 'Notas no formato pedido (ex.: "E5 D5 C5:2 | ...").' },
      bpm: { type: ['integer', 'null'], description: 'Andamento aproximado, se souber.' },
      confidence: { type: 'string', enum: ['alta', 'média', 'baixa'] },
      comment: { type: ['string', 'null'], description: 'Observação curta (trecho escolhido, dúvidas).' },
    },
    required: ['title', 'source_url', 'source_name', 'notes', 'bpm', 'confidence', 'comment'],
    additionalProperties: false,
  },
}

// Cada rodada reenvia o histórico (com os resultados da busca); poucas rodadas limitam o gasto.
const MAX_TURNS = 3

// Preço por milhão de tokens (entrada/saída) para estimar o gasto nos logs (`wrangler tail`).
const PRICES: Record<string, [number, number]> = {
  'claude-sonnet-5': [2, 10],
  'claude-opus-5': [5, 25],
}

function logUsage(model: string, turn: number, response: Anthropic.Beta.BetaMessage) {
  const u = response.usage
  const searches = u.server_tool_use?.web_search_requests ?? 0
  const [inPrice, outPrice] = PRICES[model] ?? [0, 0]
  const input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  const usd = (input * inPrice + u.output_tokens * outPrice) / 1e6 + searches * 0.01
  console.log(
    `usage turn=${turn} model=${response.model} stop=${response.stop_reason} in=${input} out=${u.output_tokens} searches=${searches} ~US$${usd.toFixed(3)}`,
  )
}

/** Traduz erros da API em mensagens úteis para o app (sem expor detalhes internos). */
function toSearchError(e: unknown): Error {
  console.error('anthropic api error', e)
  if (e instanceof Anthropic.AuthenticationError) return new SearchError('Chave da API inválida no Worker.')
  if (e instanceof Anthropic.RateLimitError) return new SearchError('Limite da API atingido. Tente em alguns minutos.')
  if (e instanceof Anthropic.BadRequestError) {
    const apiMessage = (e.error as { error?: { message?: string } } | undefined)?.error?.message
    return new SearchError(
      `A API recusou esta busca${apiMessage ? ` (${apiMessage})` : ''}. Tente outra música, ou use as abas Notas ou MIDI.`,
    )
  }
  if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) {
    return new SearchError('O serviço da API está instável agora. Tente de novo em instantes.')
  }
  return e instanceof Error ? e : new Error(String(e))
}

export async function searchMelody(query: string, env: SearchEnv): Promise<SearchResult> {
  const model = env.MODEL || 'claude-opus-5'
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 240_000 })
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `Música: ${query}` }]
  // Fallback automático em caso de recusa só existe para os modelos da linha Opus 5/Fable.
  const fallback = /^claude-(opus-5|fable-5)/.test(model)
    ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
    : {}

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response: Anthropic.Beta.BetaMessage
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }, SUBMIT_TOOL],
        messages,
        ...fallback,
      })
    } catch (e) {
      throw toSearchError(e)
    }
    logUsage(model, turn, response)

    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'submit_melody') return normalize(block.input)
    }
    if (response.stop_reason === 'refusal') throw new SearchError('A busca não pôde ser feita para essa música.')

    messages.push({ role: 'assistant', content: response.content })
    // pause_turn: o servidor retoma sozinho ao reenviar. Nos demais casos, pede o envio do resultado.
    if (response.stop_reason !== 'pause_turn') {
      messages.push({ role: 'user', content: 'Envie agora o resultado final chamando submit_melody.' })
    }
  }
  throw new SearchError('Não consegui encontrar essa melodia. Tente outro nome ou cole as notas.')
}

const CONFIDENCE = ['alta', 'média', 'baixa'] as const

export function normalize(input: unknown): SearchResult {
  const o = (input ?? {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const notes = str(o.notes, 4000)
  if (!notes) throw new SearchError('A busca não retornou notas.')
  const url = str(o.source_url, 500)
  const bpm = typeof o.bpm === 'number' && o.bpm >= 30 && o.bpm <= 260 ? Math.round(o.bpm) : null
  return {
    title: str(o.title, 120) ?? 'Sem título',
    sourceUrl: url && /^https?:\/\//.test(url) ? url : null,
    sourceName: str(o.source_name, 80),
    notes,
    bpm,
    confidence: CONFIDENCE.includes(o.confidence as (typeof CONFIDENCE)[number])
      ? (o.confidence as SearchResult['confidence'])
      : 'baixa',
    comment: str(o.comment, 400),
  }
}
