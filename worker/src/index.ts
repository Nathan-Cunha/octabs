import { searchMelody, SearchError, type SearchEnv, type SearchResult } from './search'

export interface Env extends SearchEnv {
  APP_TOKEN: string
  ALLOWED_ORIGINS: string
}

type Searcher = (query: string, env: Env) => Promise<SearchResult>

// Limite simples por instância do Worker: evita gastar créditos com cliques repetidos.
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 6
const recent: number[] = []

function rateLimited(now = Date.now()): boolean {
  while (recent.length && now - recent[0] > RATE_WINDOW_MS) recent.shift()
  if (recent.length >= RATE_MAX) return true
  recent.push(now)
  return false
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] ?? '',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

export function createHandler(search: Searcher) {
  return async function fetch(request: Request, env: Env, ctx: Pick<ExecutionContext, 'waitUntil'>) {
    const cors = corsHeaders(request, env)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const { pathname } = new URL(request.url)
    if (pathname !== '/search' || request.method !== 'POST') return json({ error: 'Não encontrado' }, 404)

    const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!env.APP_TOKEN || !safeEqual(token, env.APP_TOKEN)) return json({ error: 'Não autorizado' }, 401)

    const body = (await request.json().catch(() => null)) as { query?: unknown } | null
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 200) : ''
    if (!query) return json({ error: 'Informe o nome da música.' }, 400)
    if (rateLimited()) return json({ error: 'Muitas buscas seguidas. Espere um minuto.' }, 429)

    // A busca pode passar de um minuto: envia espaços periodicamente para manter a conexão
    // viva e o JSON no final (espaços antes do JSON não atrapalham o parse).
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const enc = new TextEncoder()
    const beat = setInterval(() => void writer.write(enc.encode(' ')).catch(() => {}), 10_000)

    const work = (async () => {
      try {
        const result = await search(query, env)
        await writer.write(enc.encode(JSON.stringify(result)))
      } catch (e) {
        console.error('search failed', e)
        const message = e instanceof SearchError ? e.message : 'Falha na busca. Tente de novo em instantes.'
        await writer.write(enc.encode(JSON.stringify({ error: message })))
      } finally {
        clearInterval(beat)
        await writer.close().catch(() => {})
      }
    })()
    ctx.waitUntil(work)

    return new Response(readable, {
      headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  }
}

export default { fetch: createHandler(searchMelody) } satisfies ExportedHandler<Env>
