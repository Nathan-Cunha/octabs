import { useMemo, useState } from 'react'
import { parseText } from '../music/parseText'
import { isNote, type MelodyItem } from '../music/types'

type Tab = 'paste' | 'midi' | 'ai'

export interface NewSongData {
  title: string
  items: MelodyItem[]
  source?: string
}

interface Props {
  onCreate(data: NewSongData): void
  onCancel(): void
}

export function SongInput({ onCreate, onCancel }: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  const parsed = useMemo(() => parseText(text), [text])
  const noteCount = parsed.items.filter(isNote).length

  return (
    <div>
      <div className="topbar">
        <button className="btn" onClick={onCancel} aria-label="Voltar">
          ←
        </button>
        <h1>Nova música</h1>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>
            Buscar
          </button>
          <button role="tab" aria-selected={tab === 'paste'} onClick={() => setTab('paste')}>
            Colar notas
          </button>
          <button role="tab" aria-selected={tab === 'midi'} onClick={() => setTab('midi')}>
            MIDI
          </button>
        </div>

        {tab === 'paste' && (
          <>
            <p>
              <input
                type="text"
                placeholder="Nome da música"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </p>
            <textarea
              placeholder={'Ex.: E D C D E E E\nou: Mi Ré Dó Ré Mi Mi Mi'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <details className="hint">
              <summary>Formatos aceitos</summary>
              <ul>
                <li>
                  Letras: <code>C D E F G A B</code>, com acidente <code>C# Eb</code> e oitava opcional{' '}
                  <code>C4 G5</code>
                </li>
                <li>
                  Solfejo: <code>Dó Ré Mi Fá Sol Lá Si</code> (<code>Fá# Sib Sol4</code>)
                </li>
                <li>
                  Estilo noobnotes: <code>.G</code> uma oitava abaixo, <code>E'</code> uma acima
                </li>
                <li>
                  Duração: <code>C:2</code> (2 tempos), <code>D:0.5</code>. Pausa: <code>-</code>
                </li>
                <li>
                  Nova frase: <code>|</code> ou quebra de linha
                </li>
                <li>O tom é ajustado automaticamente para caber na ocarina.</li>
              </ul>
            </details>
            <p className="hint">
              {noteCount} nota{noteCount === 1 ? '' : 's'}
              {parsed.unknown.length > 0 && (
                <span className="warn"> · não entendi: {parsed.unknown.slice(0, 8).join(' ')}</span>
              )}
            </p>
            <button
              className="btn primary"
              disabled={noteCount === 0}
              onClick={() =>
                onCreate({ title: title.trim() || 'Sem título', items: parsed.items, source: 'colado' })
              }
            >
              Gerar tablatura
            </button>
          </>
        )}

        {tab === 'midi' && <p className="empty">Importar arquivo MIDI — em breve.</p>}
        {tab === 'ai' && <p className="empty">Busca por nome da música — em breve.</p>}
      </div>
    </div>
  )
}
