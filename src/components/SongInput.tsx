import { useMemo, useRef, useState } from 'react'
import type { ConvertResult } from '../llm/localLlm'
import { readMidi, trackBarRange, trackToMelody, type MidiFileInfo } from '../music/parseMidi'
import { parseText } from '../music/parseText'
import { isNote, type MelodyItem } from '../music/types'
import { LlmTab } from './LlmTab'

type Tab = 'paste' | 'llm' | 'midi'

export interface NewSongData {
  title: string
  items: MelodyItem[]
  source?: string
  bpm?: number
}

interface Props {
  onCreate(data: NewSongData): void
  onCancel(): void
}

export function SongInput({ onCreate, onCancel }: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [source, setSource] = useState<string | undefined>()
  const [aiComment, setAiComment] = useState<string | null>(null)

  const parsed = useMemo(() => parseText(text), [text])
  const noteCount = parsed.items.filter(isNote).length

  function fillFromLlm(r: ConvertResult) {
    if (r.title) setTitle(r.title)
    setText(r.notes)
    setSource('IA local')
    setAiComment(r.comment)
    setTab('paste')
  }

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
          <button role="tab" aria-selected={tab === 'paste'} onClick={() => setTab('paste')}>
            Notas
          </button>
          <button role="tab" aria-selected={tab === 'llm'} onClick={() => setTab('llm')}>
            IA local
          </button>
          <button role="tab" aria-selected={tab === 'midi'} onClick={() => setTab('midi')}>
            MIDI
          </button>
        </div>

        {tab === 'llm' && <LlmTab onResult={fillFromLlm} />}

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
                <li>Tem um link, um print ou um texto bagunçado? Use a aba IA local.</li>
              </ul>
            </details>
            {source && <p className="hint">Fonte: {source}</p>}
            {aiComment && <p className="hint">Observação da IA: {aiComment}</p>}
            <p className="hint">
              {noteCount} nota{noteCount === 1 ? '' : 's'}
              {parsed.unknown.length > 0 && (
                <span className="warn"> · não entendi: {parsed.unknown.slice(0, 8).join(' ')}</span>
              )}
            </p>
            <button
              className="btn primary"
              disabled={noteCount === 0}
              onClick={() => onCreate({ title: title.trim() || 'Sem título', items: parsed.items, source: source ?? 'colado' })}
            >
              Gerar tablatura
            </button>
          </>
        )}

        {tab === 'midi' && <MidiTab onCreate={onCreate} />}
      </div>
    </div>
  )
}

function MidiTab({ onCreate }: { onCreate(data: NewSongData): void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [info, setInfo] = useState<MidiFileInfo | null>(null)
  const [fileName, setFileName] = useState('')
  const [track, setTrack] = useState(0)
  const [fromBar, setFromBar] = useState(1)
  const [toBar, setToBar] = useState(8)
  const [error, setError] = useState('')

  const items = useMemo(
    () => (info ? trackToMelody(info, track, { fromBar, toBar: Math.max(fromBar, toBar) }) : []),
    [info, track, fromBar, toBar],
  )
  const noteCount = items.filter(isNote).length

  // Por padrão pega a música inteira: do primeiro ao último compasso com notas na trilha.
  function selectTrack(i: MidiFileInfo, index: number) {
    const range = trackBarRange(i, index)
    setTrack(index)
    setFromBar(range.first)
    setToBar(range.last)
  }

  async function load(file: File) {
    setError('')
    try {
      const i = readMidi(new Uint8Array(await file.arrayBuffer()))
      setInfo(i)
      setFileName(file.name)
      selectTrack(i, i.suggested)
    } catch {
      setInfo(null)
      setError('Não consegui ler esse arquivo. Ele é mesmo um MIDI (.mid)?')
    }
  }

  return (
    <>
      <p className="hint">
        Baixe o MIDI da música (por exemplo no MuseScore ou em bitmidi.com) e escolha a trilha da melodia.
      </p>
      <button className="btn" onClick={() => fileRef.current?.click()}>
        {info ? 'Trocar arquivo' : 'Escolher arquivo MIDI'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void load(f)
          e.target.value = ''
        }}
      />
      {error && <p className="warn">{error}</p>}

      {info && (
        <>
          <p className="hint">
            {fileName} · {info.totalBars} compassos · {info.bpm} bpm
          </p>
          <p>
            <label>
              Trilha
              <select value={track} onChange={(e) => selectTrack(info, Number(e.target.value))} style={{ width: '100%' }}>
                {info.tracks.map((t) => (
                  <option key={t.index} value={t.index} disabled={t.noteCount === 0}>
                    {t.name}
                    {t.instrument ? ` (${t.instrument})` : ''} · {t.noteCount} notas
                    {t.isDrum ? ' · percussão' : ''}
                    {t.index === info.suggested ? ' ★ melodia?' : ''}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <div className="row">
            <label>
              Do compasso{' '}
              <input
                type="number"
                min={1}
                max={info.totalBars}
                value={fromBar}
                onChange={(e) => setFromBar(Math.max(1, Number(e.target.value)))}
                style={{ width: 70 }}
              />
            </label>
            <label>
              até{' '}
              <input
                type="number"
                min={fromBar}
                max={info.totalBars}
                value={toBar}
                onChange={(e) => setToBar(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
          </div>
          <p className="hint">{noteCount} notas no trecho</p>
          <button
            className="btn primary"
            disabled={noteCount === 0}
            onClick={() =>
              onCreate({
                title: fileName.replace(/\.midi?$/i, '').replace(/[_-]+/g, ' '),
                items,
                source: fileName,
                bpm: info.bpm,
              })
            }
          >
            Gerar tablatura
          </button>
        </>
      )}
    </>
  )
}
