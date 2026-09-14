// Formato interno único: colar notas, MIDI e busca por IA convergem aqui.

/** Uma nota (midi = número MIDI, 60 = Dó central/C4) ou uma pausa (midi = null). */
export interface NoteEvent {
  kind: 'note'
  midi: number | null
  /** Duração em tempos (1 = semínima). */
  dur: number
}

/** Quebra de frase: vira um espaço maior na tablatura. */
export interface PhraseBreak {
  kind: 'break'
}

export type MelodyItem = NoteEvent | PhraseBreak

export interface Song {
  id: string
  title: string
  /** De onde veio a melodia (URL, "colado", nome do arquivo MIDI). */
  source?: string
  /** Melodia no tom original, como foi informada. */
  items: MelodyItem[]
  /** Deslocamento em semitons aplicado para caber na ocarina. */
  transpose: number
  /** Andamento em batidas por minuto. */
  bpm: number
  createdAt: number
  updatedAt: number
}

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const NOTE_NAMES_PT = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'] as const

export function midiToName(midi: number, lang: 'en' | 'pt' = 'en'): string {
  const names = lang === 'pt' ? NOTE_NAMES_PT : NOTE_NAMES_SHARP
  const octave = Math.floor(midi / 12) - 1
  return `${names[((midi % 12) + 12) % 12]}${octave}`
}

export function isNote(item: MelodyItem): item is NoteEvent & { midi: number } {
  return item.kind === 'note' && item.midi !== null
}
