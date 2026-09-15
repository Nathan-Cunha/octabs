// Conversão de texto colado em notas usando uma LLM local (Ollama no PC). Grátis e offline.

export interface LlmSettings {
  baseUrl: string
  model: string
}

export interface ConvertResult {
  title: string | null
  notes: string
  comment: string | null
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = { baseUrl: 'http://localhost:11434', model: 'qwen3.5:9b' }

const KEY = 'octabs:llm'
const MAX_INPUT = 6000

export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_LLM_SETTINGS, ...(JSON.parse(raw) as Partial<LlmSettings>) }
  } catch {
    /* sem armazenamento */
  }
  return { ...DEFAULT_LLM_SETTINGS }
}

export function saveLlmSettings(s: LlmSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sem armazenamento */
  }
}

const SYSTEM_PROMPT = `Você converte textos com melodias em uma lista de notas para um app de ocarina.
O usuário cola o texto de uma página (sites de notas em letras, tablaturas, partituras em texto). O texto pode misturar letra da música, acordes, títulos e instruções.

Regras:
- Extraia só as notas da melodia, na ordem em que aparecem. Ignore letra, acordes (ex.: Am, G7, C/E), números de compasso e comentários.
- Não invente, não complete e não corrija notas: use apenas as que estão no texto.
- Campo notes: tokens separados por espaço, cada um com a letra da nota em inglês (C D E F G A B), acidente opcional (# ou b) e a oitava, onde C4 é o dó central. Exemplo: C5 D#5 Bb4.
- Solfejo vira letras: Dó=C, Ré=D, Mi=E, Fá=F, Sol=G, Lá=A, Si=B.
- Estilo noobnotes: ponto antes da nota = uma oitava abaixo (.G = G4); apóstrofo ou asterisco depois = uma oitava acima (E' = E6); sem marca = oitava 5.
- Se o texto não indicar oitava, use a oitava 5.
- Coloque | onde o original quebra a linha ou a frase da melodia.
- Duração só se o texto indicar claramente (ex.: C5:2 para 2 tempos); senão omita.
- title: nome da música se aparecer no texto, senão null. comment: observação curta em português, ou null.
- Se não houver notas no texto, devolva notes vazio.`

const EXAMPLE_INPUT = `Brilha Brilha Estrelinha - notas para flauta

Brilha, brilha, estrelinha
C C G G A A G
Quero ver você brilhar
F F E E D D C

Acordes: C F C G7 C`

const EXAMPLE_OUTPUT: ConvertResult = {
  title: 'Brilha Brilha Estrelinha',
  notes: 'C5 C5 G5 G5 A5 A5 G5 | F5 F5 E5 E5 D5 D5 C5',
  comment: null,
}

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: ['string', 'null'] },
    notes: { type: 'string' },
    comment: { type: ['string', 'null'] },
  },
  required: ['title', 'notes', 'comment'],
}

const base = (s: LlmSettings) => s.baseUrl.trim().replace(/\/+$/, '')

async function call(s: LlmSettings, path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(base(s) + path, init)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error(
      `Não consegui conectar ao Ollama em ${base(s)}. Confira se ele está aberto no PC` +
        ' (e, no celular, se o Tailscale está ligado e o endereço é o https do PC).',
    )
  }
}

export async function listModels(s: LlmSettings): Promise<string[]> {
  const res = await call(s, '/api/tags')
  if (!res.ok) throw new Error(`O Ollama respondeu com erro ${res.status}.`)
  const data = (await res.json()) as { models?: { name: string }[] }
  return (data.models ?? []).map((m) => m.name)
}

export async function convertWithLlm(text: string, s: LlmSettings, signal?: AbortSignal): Promise<ConvertResult> {
  const input = text.trim().slice(0, MAX_INPUT)
  if (!input) throw new Error('Cole o texto com as notas.')

  const res = await call(s, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: s.model,
      stream: false,
      think: false,
      format: SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: EXAMPLE_INPUT },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        { role: 'user', content: input },
      ],
    }),
  })
  const data = (await res.json().catch(() => null)) as { message?: { content?: string }; error?: string } | null
  if (res.status === 404) {
    throw new Error(`O modelo "${s.model}" não está instalado. No PC, rode: ollama pull ${s.model}`)
  }
  if (!res.ok) throw new Error(data?.error ? `Ollama: ${data.error}` : `O Ollama respondeu com erro ${res.status}.`)
  return parseResult(data?.message?.content ?? '')
}

export function parseResult(content: string): ConvertResult {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error('A IA não devolveu um resultado válido. Tente de novo.')
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const notes = str(o.notes, 4000)
  if (!notes) throw new Error('A IA não encontrou notas nesse texto.')
  return { title: str(o.title, 120), notes, comment: str(o.comment, 300) }
}
