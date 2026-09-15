import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertWithLlm, DEFAULT_LLM_SETTINGS, listModels, parseResult } from './localLlm'

const settings = { ...DEFAULT_LLM_SETTINGS, baseUrl: 'http://localhost:11434/' }
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('localLlm', () => {
  it('envia o texto ao Ollama com schema e sem pensar, e lê o resultado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: { content: '{"title":"Teste","notes":"C5 D5 | E5","comment":null}' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const r = await convertWithLlm('Dó Ré | Mi', settings)
    expect(r).toEqual({ title: 'Teste', notes: 'C5 D5 | E5', comment: null })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ model: 'qwen3.5:9b', stream: false, think: false })
    expect(body.format.required).toEqual(['title', 'notes', 'comment'])
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Dó Ré | Mi' })
  })

  it('explica quando o modelo não está instalado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: "model 'x' not found" }, 404)))
    await expect(convertWithLlm('C D E', settings)).rejects.toThrow('ollama pull qwen3.5:9b')
  })

  it('explica quando não consegue conectar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(listModels(settings)).rejects.toThrow('Não consegui conectar ao Ollama')
  })

  it('lista os modelos instalados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: 'qwen3.5:9b' }] })))
    expect(await listModels(settings)).toEqual(['qwen3.5:9b'])
  })

  it('valida a resposta', () => {
    expect(() => parseResult('não é json')).toThrow('resultado válido')
    expect(() => parseResult('{"title":null,"notes":"  ","comment":null}')).toThrow('não encontrou notas')
  })
})
