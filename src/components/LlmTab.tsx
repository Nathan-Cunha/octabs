import { useEffect, useRef, useState, type ClipboardEvent } from 'react'
import { prepareImage, type PreparedImage } from '../llm/image'
import {
  convertWithLlm,
  fetchPageText,
  listModels,
  loadLlmSettings,
  saveLlmSettings,
  tryDirectParse,
  type ConvertResult,
  type LlmSettings,
} from '../llm/localLlm'

export function LlmTab({ onResult }: { onResult(r: ConvertResult, source?: string): void }) {
  const [settings, setSettings] = useState<LlmSettings>(loadLlmSettings)
  const [raw, setRaw] = useState('')
  const [link, setLink] = useState('')
  const [image, setImage] = useState<PreparedImage | null>(null)
  const [busy, setBusy] = useState<'' | 'link' | 'convert'>('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const abort = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ao sair da aba, cancela o pedido para o PC não continuar trabalhando à toa.
  useEffect(() => () => abort.current?.abort(), [])

  function start() {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setError('')
    return ctrl
  }

  async function loadImage(file: Blob) {
    setError('')
    try {
      setImage(await prepareImage(file))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      void loadImage(file)
    }
  }

  async function readLink() {
    const ctrl = start()
    setBusy('link')
    try {
      const text = await fetchPageText(link, ctrl.signal)
      // Página já em notas (ex.: noobnotes): vai direto para a aba Notas, sem IA.
      const direct = tryDirectParse(text)
      if (direct) onResult(direct, link.trim())
      else setRaw(text)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function convert() {
    const ctrl = start()
    setBusy('convert')
    try {
      const result = await convertWithLlm({ text: raw, images: image ? [image.base64] : [] }, settings, ctrl.signal)
      onResult(result, image ? 'IA local (print)' : 'IA local')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  async function testConnection() {
    saveLlmSettings(settings)
    setStatus('Testando…')
    try {
      const models = await listModels(settings)
      if (models.length === 0) setStatus('Conectado, mas nenhum modelo foi baixado ainda.')
      else if (!models.includes(settings.model)) setStatus(`Conectado. "${settings.model}" não está instalado; há: ${models.join(', ')}`)
      else setStatus(`Conectado e pronto (${settings.model}).`)
    } catch (e) {
      setStatus((e as Error).message)
    }
  }

  return (
    <div onPaste={onPaste}>
      <p className="hint">
        Mande as notas da música do jeito que tiver: link da página, print ou texto colado. A IA roda no seu PC, de
        graça, e só organiza as notas que encontrar — letra e acordes são ignorados.
      </p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (link.trim() && !busy) void readLink()
        }}
      >
        <input
          type="url"
          placeholder="Link da página com as notas"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn" disabled={!link.trim() || !!busy}>
          {busy === 'link' ? 'Lendo…' : 'Ler link'}
        </button>
      </form>

      <p className="row">
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          📷 {image ? 'Trocar print' : 'Print ou foto'}
        </button>
        <span className="hint">ou cole a imagem aqui (Ctrl+V)</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void loadImage(f)
            e.target.value = ''
          }}
        />
      </p>
      {image && (
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <img src={image.dataUrl} alt="Print enviado" style={{ maxHeight: 160, maxWidth: '70%', borderRadius: 8 }} />
          <button className="btn danger" onClick={() => setImage(null)} aria-label="Remover print">
            ✕
          </button>
        </div>
      )}

      <textarea
        placeholder={'…ou cole aqui o texto da página'}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        spellCheck={false}
      />

      <div className="row">
        <button className="btn primary" disabled={(!raw.trim() && !image) || !!busy} onClick={() => void convert()}>
          {busy === 'convert' ? 'Convertendo…' : 'Converter'}
        </button>
        {busy && (
          <button className="btn" onClick={() => abort.current?.abort()}>
            Cancelar
          </button>
        )}
      </div>
      {busy === 'convert' && (
        <p className="hint">
          Pode levar alguns segundos ({image ? 'prints demoram mais, uns 15–30 s' : 'na primeira vez o PC carrega o modelo'}).
        </p>
      )}
      {image && !busy && <p className="hint">Com prints a IA pode pular ou trocar notas: confira ouvindo no ▶.</p>}
      {error && <p className="warn">{error}</p>}

      <details className="hint">
        <summary>Conexão com o Ollama</summary>
        <p>
          <label>
            Endereço
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value.trim() })}
            />
          </label>
        </p>
        <p>
          <label>
            Modelo
            <input
              type="text"
              value={settings.model}
              onChange={(e) => setSettings({ ...settings, model: e.target.value.trim() })}
            />
          </label>
        </p>
        <div className="row">
          <button className="btn" onClick={() => void testConnection()}>
            Salvar e testar
          </button>
        </div>
        {status && <p>{status}</p>}
        <p>
          No PC use <code>http://localhost:11434</code>. No celular, o PC precisa estar ligado, com o Tailscale ligado
          nos dois, usando o endereço <code>https://</code> do PC.
        </p>
      </details>
    </div>
  )
}
