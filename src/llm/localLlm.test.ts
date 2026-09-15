import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  convertWithLlm,
  DEFAULT_LLM_SETTINGS,
  extractMelodyLines,
  fetchPageText,
  listModels,
  parseResult,
  tryDirectParse,
} from './localLlm'

const settings = { ...DEFAULT_LLM_SETTINGS, baseUrl: 'http://localhost:11434/' }
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const okResult = () => jsonResponse({ message: { content: '{"title":"Teste","notes":"C5 D5 | E5","comment":null}' } })

afterEach(() => vi.unstubAllGlobals())

describe('convertWithLlm', () => {
  it('envia o texto ao Ollama com schema, sem pensar e com limite de resposta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResult())
    vi.stubGlobal('fetch', fetchMock)

    const r = await convertWithLlm({ text: 'Dó Ré | Mi' }, settings)
    expect(r).toEqual({ title: 'Teste', notes: 'C5 D5 | E5', comment: null })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      model: 'qwen3.5:9b',
      stream: false,
      think: false,
      options: { num_ctx: 4096, num_predict: 1024 },
    })
    expect(body.format.required).toEqual(['title', 'notes', 'comment'])
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Dó Ré | Mi' })
  })

  it('envia o print como imagem, com contexto maior', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: { content: '{"title":null,"notes":"E5 E5","comment":null}' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await convertWithLlm({ images: ['aGVsbG8='] }, settings)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.options.num_ctx).toBe(8192)
    expect(body.messages.at(-1).images).toEqual(['aGVsbG8='])
    expect(body.messages.at(-1).content).toMatch(/imagem/)
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
  // Trecho no formato real do noobnotes: legenda com *, ^ antes da nota e notas grudadas.
  const page = `Title: Jingle Bells - Traditional - music notes for newbies

Home | Songs | About
*   .D .C#
*   D C#
Jingle bells, jingle bells
(D^) B - B B B - B B B-^D G A B
^C^C^C^C^C B B
Oh what fun it is to ride
B B B A A-B A-^D
Share on Facebook`

  it('mantém só as linhas de melodia, sem a legenda do site', () => {
    expect(extractMelodyLines(page)).toBe(
      'Title: Jingle Bells - Traditional - music notes for newbies\n' +
        '(D^) B - B B B - B B B-^D G A B\n^C^C^C^C^C B B\nB B B A A-B A-^D',
    )
  })

  it('sem linhas de notas, devolve o texto da página', () => {
    expect(extractMelodyLines('Só texto aqui\nnada de notas')).toBe('Só texto aqui\nnada de notas')
  })

  it('página já em notas é lida direto, sem IA', () => {
    const r = tryDirectParse(extractMelodyLines(page))
    expect(r).not.toBeNull()
    expect(r!.title).toBe('Jingle Bells - Traditional')
    expect(r!.notes.split('\n')[1]).toBe('^C^C^C^C^C B B')
    expect(r!.comment).toMatch(/sem IA/)
  })

  it('texto bagunçado não é lido direto', () => {
    expect(tryDirectParse('Algumas palavras quaisquer\nC D E')).toBeNull()
  })

  it('lê a página pelo leitor e filtra', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(page))
    vi.stubGlobal('fetch', fetchMock)
    const text = await fetchPageText(' https://noobnotes.net/jingle-bells-traditional/ ')
    expect(fetchMock.mock.calls[0][0]).toBe('https://r.jina.ai/https://noobnotes.net/jingle-bells-traditional/')
    expect(text).toContain('^C^C^C^C^C B B')
    expect(text).not.toContain('Share on Facebook')
    expect(text).not.toContain('.D .C#')
  })

  it('recusa link inválido', async () => {
    await expect(fetchPageText('noobnotes')).rejects.toThrow('Link inválido')
    await expect(fetchPageText('ftp://x.com/a')).rejects.toThrow('http')
  })
})
