import { useEffect, useMemo, useRef, useState } from 'react'
import { playMelody, playNote, type PlayHandle } from '../audio/player'
import { applyTranspose, bestTranspose, scoreShift } from '../music/transpose'
import { isNote, type Song } from '../music/types'
import { TabSheet } from './TabSheet'

interface Props {
  song: Song
  saved: boolean
  onBack(): void
  onSave(song: Song): void
}

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`octabs:${key}`)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`octabs:${key}`, JSON.stringify(value))
  } catch {
    /* sem armazenamento: ignora */
  }
}

export function SongView({ song: initial, saved, onBack, onSave }: Props) {
  const [song, setSong] = useState(initial)
  const [current, setCurrent] = useState(-1)
  const [startAt, setStartAt] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [showNames, setShowNames] = useState(() => loadPref('showNames', true))
  const [lang, setLang] = useState<'pt' | 'en'>(() => loadPref('lang', 'pt'))
  const handle = useRef<PlayHandle | null>(null)

  const items = useMemo(() => applyTranspose(song.items, song.transpose), [song.items, song.transpose])
  const outOfRange = useMemo(() => scoreShift(song.items, song.transpose).outOfRange, [song])

  // Salva automaticamente mudanças de tom/andamento em músicas já salvas.
  useEffect(() => {
    if (saved && song !== initial) onSave(song)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.transpose, song.bpm, song.title])

  useEffect(() => savePref('showNames', showNames), [showNames])
  useEffect(() => savePref('lang', lang), [lang])

  // Mantém a tela ligada enquanto pratica.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen')
      } catch {
        /* não suportado */
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release()
    }
  }, [])

  useEffect(() => () => handle.current?.stop(), [])

  function stop() {
    handle.current?.stop()
    handle.current = null
    setPlaying(false)
  }

  function play() {
    stop()
    setPlaying(true)
    handle.current = playMelody(
      items,
      song.bpm,
      (i) => {
        setCurrent(i)
        if (i === -1) setPlaying(false)
      },
      startAt,
    )
  }

  function tap(index: number) {
    setStartAt(index)
    setCurrent(index)
    const it = items[index]
    if (!playing && it && isNote(it)) playNote(it.midi, 0.45)
  }

  const shift = (delta: number) => {
    stop()
    setSong((s) => ({ ...s, transpose: s.transpose + delta }))
  }

  return (
    <div>
      <div className="topbar">
        <button className="btn" onClick={onBack} aria-label="Voltar">
          ←
        </button>
        <h1>{song.title}</h1>
        {!saved && (
          <button className="btn primary" onClick={() => onSave(song)}>
            Salvar
          </button>
        )}
      </div>

      <div className="card row">
        <span>
          Tom: <strong>{song.transpose > 0 ? `+${song.transpose}` : song.transpose}</strong> semitons
        </span>
        <button className="btn" onClick={() => shift(-1)} aria-label="Meio tom abaixo">
          −
        </button>
        <button className="btn" onClick={() => shift(1)} aria-label="Meio tom acima">
          +
        </button>
        <button className="btn" onClick={() => shift(bestTranspose(song.items) - song.transpose)}>
          Auto
        </button>
        <label className="row">
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
          Notas
        </label>
        <button className="btn" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}>
          {lang === 'pt' ? 'Dó Ré Mi' : 'C D E'}
        </button>
        {outOfRange > 0 && (
          <span className="warn">
            {outOfRange} nota{outOfRange === 1 ? '' : 's'} fora da extensão da ocarina
          </span>
        )}
      </div>

      <TabSheet items={items} current={current} showNames={showNames} lang={lang} onTap={tap} />

      <div className="player">
        <button
          className="btn"
          onClick={() => {
            stop()
            setStartAt(0)
            setCurrent(-1)
          }}
          aria-label="Voltar ao início"
        >
          ⏮
        </button>
        <button className="btn primary" onClick={playing ? stop : play} style={{ minWidth: 88 }}>
          {playing ? '⏹ Parar' : '▶ Tocar'}
        </button>
        <label className="row">
          <input
            type="range"
            min={40}
            max={200}
            step={5}
            value={song.bpm}
            onChange={(e) => setSong((s) => ({ ...s, bpm: Number(e.target.value) }))}
          />
          {song.bpm} bpm
        </label>
      </div>
    </div>
  )
}
