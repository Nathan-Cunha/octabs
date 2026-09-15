import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  convertWithLlm,
  DEFAULT_LLM_SETTINGS,
  extractMelodyLines,
  fetchPageText,
  listModels,
  parseResult,
} from './localLlm'

const settings = { ...DEFAULT_LLM_SETTINGS, baseUrl: 'http://localhost:11434/' }
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const okResult = jsonResponse({ message: { content: '{"title":"Teste","notes":"C5 D5 | E5","comment":null}' } })

afterEach(() => vi.unstubAllGlobals())

describe('convertWithLlm', () => {
  it('envia o texto ao Ollama com schema, contexto maior e sem pensar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResult)
    vi.stubGlobal('fetch', fetchMock)

    const r = await convertWithLlm({ text: 'Dó Ré | Mi' }, settings)
    expect(r).toEqual({ title: 'Teste', notes: 'C5 D5 | E5', comment: null })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ model: 'qwen3.5:9b', stream: false, think: false, options: { num_ctx: 8192 } })
    expect(body.format.required).toEqual(['title', 'notes', 'comment'])
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Dó Ré | Mi' })
  })

  it('envia o print como imagem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: { content: '{"title":null,"notes":"E5 E5","comment":null}' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await convertWithLlm({ images: ['aGVsbG8='] }, settings)
    const last = JSON.parse(fetchMock.mock.calls[0][1].body).messages.at(-1)
    expect(last.images).toEqual(['aGVsbG8='])
    expect(last.content).toMatch(/imagem/)
  })

  it('exige algum conteúdo', async () => {
    await expect(convertWithLlm({ text: '  ' }, settings)).rejects.toThrow('Cole um texto')
  })

  it('explica quando o modelo não está instalado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: "model 'x' not found" }, 404)))
    await expect(convertWithLlm({ text: 'C D E' }, settings)).rejects.toThrow('ollama pull qwen3.5:9b')
  })

  it('explica quando não consegue conectar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(listModels(settings)).rejects.toThrow('Não consegui conectar ao Ollama')
  })

  it('lista os modelos instalados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: 'qwen3.5:9b' }] })))
    expect(await listModels(settings)).toEqual(['qwen3.5:9b'])
  })
})

describe('parseResult', () => {
  it('valida a resposta e troca quebras de linha por frases', () => {
    expect(() => parseResult('não é json')).toThrow('resultado válido')
    expect(() => parseResult('{"title":null,"notes":"  ","comment":null}')).toThrow('não encontrou notas')
    expect(parseResult('{"title":null,"notes":"E E E\\nE G C","comment":""}')).toEqual({
      title: null,
      notes: 'E E E | E G C',
      comment: null,
    })
  })
})

describe('links', () => {
  const page = `Title: Jingle Bells - Letter Notes

Home | Songs | About
Jingle bells, jingle bells
E E E   E E E
Jingle all the way
E G C D E
Oh what fun it is to ride
.G C' D E F F
Share on Facebook`

  it('mantém só as linhas que parecem melodia', () => {
    expect(extractMelodyLines(page)).toBe(
      "Title: Jingle Bells - Letter Notes\nE E E   E E E\nE G C D E\n.G C' D E F F",
    )
  })

  it('sem linhas de notas, devolve o texto da página', () => {
    expect(extractMelodyLines('Só texto aqui\nnada de notas')).toBe('Só texto aqui\nnada de notas')
  })

  it('lê a página pelo leitor e filtra', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(page))
    vi.stubGlobal('fetch', fetchMock)
    const text = await fetchPageText(' https://noobnotes.net/jingle-bells/ ')
    expect(fetchMock.mock.calls[0][0]).toBe('https://r.jina.ai/https://noobnotes.net/jingle-bells/')
    expect(text).toContain('E G C D E')
    expect(text).not.toContain('Share on Facebook')
  })

  it('recusa link inválido', async () => {
    await expect(fetchPageText('noobnotes')).rejects.toThrow('Link inválido')
    await expect(fetchPageText('ftp://x.com/a')).rejects.toThrow('http')
  })
})
