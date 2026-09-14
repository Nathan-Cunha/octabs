import { describe, expect, it, vi } from 'vitest'
import { createHandler, type Env } from './index'
import { normalize, SearchError, type SearchResult } from './search'

const env: Env = {
  ANTHROPIC_API_KEY: 'x',
  APP_TOKEN: 'segredo-123',
  ALLOWED_ORIGINS: 'https://nathan-cunha.github.io,http://localhost:5173',
}
const ctx = { waitUntil: () => {} }

const sample: SearchResult = {
  title: 'Noite Feliz',
  sourceUrl: 'https://example.com/noite-feliz',
  sourceName: 'Exemplo',
  notes: 'G4:1.5 A4:0.5 G4 E4:3',
  bpm: 80,
  confidence: 'alta',
  comment: null,
}

const post = (body: unknown, token = env.APP_TOKEN) =>
  new Request('https://w.dev/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, origin: 'https://nathan-cunha.github.io' },
    body: JSON.stringify(body),
  })

describe('worker', () => {
  it('responde ao preflight CORS com a origem permitida', async () => {
    const handler = createHandler(vi.fn())
    const res = await handler(
      new Request('https://w.dev/search', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }),
      env,
      ctx,
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('recusa token errado sem chamar a busca', async () => {
    const search = vi.fn()
    const res = await createHandler(search)(post({ query: 'x' }, 'errado'), env, ctx)
    expect(res.status).toBe(401)
    expect(search).not.toHaveBeenCalled()
  })

  it('exige o nome da música', async () => {
    const res = await createHandler(vi.fn())(post({ query: '  ' }), env, ctx)
    expect(res.status).toBe(400)
  })

  it('devolve o resultado da busca como JSON', async () => {
    const search = vi.fn().mockResolvedValue(sample)
    const res = await createHandler(search)(post({ query: 'Noite Feliz' }), env, ctx)
    expect(res.status).toBe(200)
    expect(JSON.parse(await res.text())).toEqual(sample)
    expect(search).toHaveBeenCalledWith('Noite Feliz', env)
  })

  it('erros da busca vêm no corpo', async () => {
    const search = vi.fn().mockRejectedValue(new SearchError('Não achei'))
    const res = await createHandler(search)(post({ query: 'abc' }), env, ctx)
    expect(JSON.parse(await res.text())).toEqual({ error: 'Não achei' })
  })
})

describe('normalize', () => {
  it('limpa e valida a saída do modelo', () => {
    expect(
      normalize({
        title: ' Asa Branca ',
        source_url: 'javascript:alert(1)',
        source_name: null,
        notes: 'C4 D4 E4',
        bpm: 999,
        confidence: 'certeza',
        comment: '',
      }),
    ).toEqual({
      title: 'Asa Branca',
      sourceUrl: null,
      sourceName: null,
      notes: 'C4 D4 E4',
      bpm: null,
      confidence: 'baixa',
      comment: null,
    })
  })

  it('falha sem notas', () => {
    expect(() => normalize({ title: 'x', notes: ' ' })).toThrow(SearchError)
  })
})
