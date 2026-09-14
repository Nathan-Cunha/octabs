// Busca de melodia pelo nome, via Cloudflare Worker (a chave da API fica só no Worker).

export interface AiSettings {
  workerUrl: string
  token: string
}

export interface MelodySearchResult {
  title: string
  sourceUrl: string | null
  sourceName: string | null
  /** Notas no formato aceito pelo "Colar notas" (ex.: "E5 D5:0.5 | C5:2"). */
  notes: string
  bpm: number | null
  confidence: 'alta' | 'média' | 'baixa'
  comment: string | null
}

const KEY = 'octabs:ai'

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AiSettings
  } catch {
    /* sem armazenamento */
  }
  return { workerUrl: '', token: '' }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* sem armazenamento */
  }
}

export async function searchMelody(query: string, settings: AiSettings, signal?: AbortSignal): Promise<MelodySearchResult> {
  const url = settings.workerUrl.replace(/\/+$/, '') + '/search'
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.token}` },
      body: JSON.stringify({ query }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Sem conexão com o servidor de busca. Confira a internet e o endereço do Worker.')
  }
  // O Worker manda espaços enquanto busca e o JSON no final; erros durante a busca vêm como {error}.
  const data = (await res.json().catch(() => null)) as (MelodySearchResult & { error?: string }) | null
  if (res.status === 401) throw new Error('Token inválido. Confira as configurações da busca.')
  if (res.status === 429) throw new Error('Muitas buscas seguidas. Espere um pouco e tente de novo.')
  if (!res.ok || !data || data.error) throw new Error(data?.error ?? `Erro ${res.status} na busca.`)
  return data
}
