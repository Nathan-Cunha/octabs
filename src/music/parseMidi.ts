import { Midi } from '@tonejs/midi'
import type { MelodyItem } from './types'

export interface MidiTrackInfo {
  index: number
  name: string
  instrument: string
  noteCount: number
  isDrum: boolean
}

export interface MidiFileInfo {
  midi: Midi
  tracks: MidiTrackInfo[]
  bpm: number
  beatsPerBar: number
  totalBars: number
  /** Trilha que parece ser a melodia. */
  suggested: number
}

export function readMidi(data: ArrayBuffer | Uint8Array): MidiFileInfo {
  const midi = new Midi(data)
  const tracks: MidiTrackInfo[] = midi.tracks.map((t, index) => ({
    index,
    name: t.name || `Trilha ${index + 1}`,
    instrument: t.instrument?.name ?? '',
    noteCount: t.notes.length,
    isDrum: t.channel === 9 || t.instrument?.percussion === true,
  }))

  // Melodia costuma ser a trilha (não percussão) mais aguda e com bastante nota.
  let suggested = -1
  let bestScore = -Infinity
  for (const t of tracks) {
    if (t.isDrum || t.noteCount < 4) continue
    const notes = midi.tracks[t.index].notes
    const avgPitch = notes.reduce((s, n) => s + n.midi, 0) / notes.length
    const score = avgPitch + 3 * Math.log2(t.noteCount)
    if (score > bestScore) {
      bestScore = score
      suggested = t.index
    }
  }
  if (suggested === -1) suggested = tracks.findIndex((t) => t.noteCount > 0)

  const ppq = midi.header.ppq
  const beatsPerBar = midi.header.timeSignatures[0]?.timeSignature[0] ?? 4
  const lastTick = Math.max(0, ...midi.tracks.flatMap((t) => t.notes.map((n) => n.ticks + n.durationTicks)))

  return {
    midi,
    tracks,
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 120),
    beatsPerBar,
    totalBars: Math.max(1, Math.ceil(lastTick / ppq / beatsPerBar)),
    suggested: Math.max(0, suggested),
  }
}

/** Primeiro e último compasso (1 = primeiro) em que a trilha tem notas. */
export function trackBarRange(info: MidiFileInfo, trackIndex: number): { first: number; last: number } {
  const notes = info.midi.tracks[trackIndex]?.notes ?? []
  if (notes.length === 0) return { first: 1, last: info.totalBars }
  const ppq = info.midi.header.ppq
  const barOf = (ticks: number) => Math.floor(ticks / ppq / info.beatsPerBar) + 1
  return {
    first: barOf(Math.min(...notes.map((n) => n.ticks))),
    last: barOf(Math.max(...notes.map((n) => n.ticks))),
  }
}

const quantize = (beats: number) => Math.max(0.25, Math.round(beats * 4) / 4)

export interface TrackToMelodyOptions {
  /** Compasso inicial (1 = primeiro). */
  fromBar?: number
  /** Compasso final, inclusivo. */
  toBar?: number
}

/**
 * Converte uma trilha em melodia monofônica: em notas simultâneas fica a mais aguda,
 * durações em tempos (quantizadas em semicolcheias), pausas nos silêncios e
 * quebras de frase em pausas longas ou a cada 2 compassos corridos.
 */
export function trackToMelody(info: MidiFileInfo, trackIndex: number, opts: TrackToMelodyOptions = {}): MelodyItem[] {
  const { midi, beatsPerBar } = info
  const ppq = midi.header.ppq
  const startBeat = ((opts.fromBar ?? 1) - 1) * beatsPerBar
  const endBeat = (opts.toBar ?? info.totalBars) * beatsPerBar

  const notes = [...(midi.tracks[trackIndex]?.notes ?? [])]
    .map((n) => ({ midi: n.midi, start: n.ticks / ppq, end: (n.ticks + n.durationTicks) / ppq }))
    .filter((n) => n.start >= startBeat - 1e-6 && n.start < endBeat - 1e-6)
    .sort((a, b) => a.start - b.start || b.midi - a.midi)

  // Skyline: uma nota por ataque (a mais aguda), cortada no próximo ataque.
  const mono: typeof notes = []
  for (const n of notes) {
    const last = mono[mono.length - 1]
    if (last && Math.abs(n.start - last.start) < 0.05) continue
    if (last && last.end > n.start) last.end = n.start
    mono.push({ ...n })
  }

  const items: MelodyItem[] = []
  let cursor = startBeat
  let lastBreakBar = Math.floor(startBeat / beatsPerBar)
  const pushBreak = () => {
    if (items.length > 0 && items[items.length - 1].kind !== 'break') items.push({ kind: 'break' })
  }

  for (const n of mono) {
    const gap = n.start - cursor
    if (gap >= 0.5) {
      if (gap >= 1.5) pushBreak()
      else items.push({ kind: 'note', midi: null, dur: quantize(gap) })
    }
    const bar = Math.floor(n.start / beatsPerBar)
    if (bar - lastBreakBar >= 2 && Math.abs(n.start - bar * beatsPerBar) < 0.05) {
      pushBreak()
      lastBreakBar = bar
    }
    if (items[items.length - 1]?.kind === 'break') lastBreakBar = bar
    items.push({ kind: 'note', midi: n.midi, dur: quantize(n.end - n.start) })
    cursor = n.end
  }

  if (items[items.length - 1]?.kind === 'break') items.pop()
  return items
}
