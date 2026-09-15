// Conversão de texto, print ou link em notas usando uma LLM local (Ollama no PC). Grátis.

import { NOOBNOTES_TOKEN, parseText } from '../music/parseText'
import { isNote } from '../music/types'

export interface LlmSettings {
  baseUrl: string
  model: string
}

export interface ConvertResult {
  title: string | null
  notes: string
  comment: string | null
}

export interface ConvertInput {
  text?: string
  /** Imagens em base64 (sem o prefixo data:). */
  images?: string[]
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = { baseUrl: 'http://localhost:11434', model: 'qwen3.5:9b' }

const KEY = 'octabs:llm'
const MAX_INPUT = 12000

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

const SYSTEM_PROMPT = `Você converte melodias em uma lista de notas para um app de ocarina.
O usuário envia o texto de uma página (sites de notas em letras, tablaturas, partituras em texto) e/ou um print (imagem) com as notas. O conteúdo pode misturar letra da música, acordes, títulos e instruções.

Regras:
- Extraia só as notas da melodia, na ordem em que aparecem. Ignore letra, acordes (ex.: Am, G7, C/E), números de compasso e comentários.
- Não invente, não complete, não repita e não corrija notas: use apenas as que estão no conteúdo, uma vez cada. Em imagens, leia com atenção notas repetidas em sequência e não pule nenhuma.
- Campo notes: tokens separados por espaço, cada um com a letra da nota em inglês (C D E F G A B), acidente opcional (# ou b) e a oitava, onde C4 é o dó central. Exemplo: C5 D#5 Bb4.
- Solfejo vira letras: Dó=C, Ré=D, Mi=E, Fá=F, Sol=G, Lá=A, Si=B.
- Estilo noobnotes: ^ antes da nota = uma oitava acima (^C = C6); ponto antes = uma oitava abaixo (.G = G4); sem marca = oitava 5; hífen depois = nota longa (B- = B5:2); notas podem vir grudadas (^C^C^C = C6 C6 C6). Linhas que começam com * são a legenda do site: ignore.
- Partitura em pauta (imagem): leia as notas pela posição na pauta com clave de sol; se não conseguir ler com segurança, diga isso em comment.
- Se o conteúdo não indicar oitava, use a oitava 5.
- Coloque | onde o original quebra a linha ou a frase da melodia.
- Duração só se o conteúdo indicar claramente (ex.: C5:2 para 2 tempos); senão omita.
- title: nome da música se aparecer, senão null. comment: observação curta em português, ou null.
- Se não houver notas, devolva notes vazio.`

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
      `Não consegui conectar ao Ollama em ${base(s)}. Confira se o PC está ligado` +
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

export async function convertWithLlm(input: ConvertInput, s: LlmSettings, signal?: AbortSignal): Promise<ConvertResult> {
  const text = (input.text ?? '').trim().slice(0, MAX_INPUT)
  const images = input.images ?? []
  if (!text && images.length === 0) throw new Error('Cole um texto, um link ou um print com as notas.')

  const last: { role: 'user'; content: string; images?: string[] } = {
    role: 'user',
    content: text || 'Extraia as notas da melodia desta imagem.',
  }
  if (images.length > 0) last.images = images

  const res = await call(s, '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: s.model,
      stream: false,
      think: false,
      format: SCHEMA,
      // Imagens precisam de mais contexto. num_predict evita que a IA fique repetindo notas sem parar.
      options: { temperature: 0, num_ctx: images.length > 0 ? 8192 : 4096, num_predict: 1024 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: EXAMPLE_INPUT },
        { role: 'assistant', content: JSON.stringify(EXAMPLE_OUTPUT) },
        last,
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
    throw new Error('A IA não devolveu um resultado válido (talvez a resposta tenha ficado longa demais). Tente de novo.')
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const notes = str(o.notes, 4000)
  if (!notes) throw new Error('A IA não encontrou notas nesse conteúdo.')
  return { title: str(o.title, 120), notes: notes.replace(/\s*\n\s*/g, ' | '), comment: str(o.comment, 300) }
}

// ---- Links ----

// Leitor gratuito que devolve o texto de qualquer página e permite chamadas do navegador.
const READER = 'https://r.jina.ai/'

const NOTE_TOKEN =
  /^\.*([A-Ga-g]|d[oó]|r[eé]|mi|f[aá]|sol?|l[aá]|si)(#|b|♯|♭)?-?\d?['’*^]*(:\d+(?:[.,]\d+)?)?[,;]*$/i

const isNoteToken = (t: string) => NOTE_TOKEN.test(t) || NOOBNOTES_TOKEN.test(t)

/** Parte do texto da página que parece melodia: linhas em que a maioria das palavras são notas. */
export function extractMelodyLines(page: string, max = MAX_INPUT): string {
  const lines = page.replace(/\r/g, '').split('\n')
  const title = lines.find((l) => l.startsWith('Title:'))
  const kept = lines.filter((line) => {
    if (/^\s*[*•]/.test(line)) return false // legendas e listas do site
    const tokens = line
      .replace(/[|()[\]]/g, ' ')
      .split(/\s+/)
      .filter((t) => t && t !== '-')
    const notes = tokens.filter(isNoteToken).length
    return notes >= 3 && notes / tokens.length >= 0.6
  })
  const text = kept.length > 0 ? [title, ...kept].filter(Boolean).join('\n') : page
  return text.slice(0, max)
}

/**
 * Se o texto já está num formato de notas que o app entende (ex.: noobnotes), usa direto,
 * sem IA: é instantâneo e não erra.
 */
export function tryDirectParse(text: string): ConvertResult | null {
  const lines = text.split('\n')
  const titleLine = lines.find((l) => l.startsWith('Title:'))
  const body = lines.filter((l) => !l.startsWith('Title:')).join('\n').trim()
  const { items, unknown } = parseText(body)
  const notes = items.filter(isNote).length
  if (notes < 8 || unknown.length > Math.max(1, Math.floor(notes * 0.05))) return null
  const title = titleLine
    ? titleLine.slice('Title:'.length).replace(/\s*[-–|]\s*music notes for newbies\s*$/i, '').trim() || null
    : null
  return { title, notes: body, comment: 'Notas lidas direto da página, sem IA.' }
}

export async function fetchPageText(url: string, signal?: AbortSignal): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('Link inválido. Cole o endereço completo, começando com https://')
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('O link precisa começar com http:// ou https://')

  let res: Response
  try {
    res = await fetch(READER + parsed.href, { signal, headers: { accept: 'text/plain' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Não consegui abrir esse link agora. Tente de novo, ou copie o texto da página e cole.')
  }
  if (!res.ok) throw new Error(`Não consegui ler a página (erro ${res.status}). Copie o texto da página e cole.`)
  const text = extractMelodyLines(await res.text())
  if (!text.trim()) throw new Error('A página veio vazia. Copie o texto da página e cole.')
  return text
}
