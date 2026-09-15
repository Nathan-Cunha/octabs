import type { MelodyItem } from './types'

// Aceita, misturados:
//   letras com oitava:     C4 D#4 Eb5 F5
//   letras sem oitava:     C D E F G   (oitava "atual", começando na 5)
//   estilo noobnotes:      ^C  .G  B-  ^C^C^C  (^ antes = oitava acima, ponto antes = abaixo,
//                          hífen depois = nota longa, notas podem vir grudadas)
//   apóstrofo depois:      E'  (uma oitava acima)
//   solfejo pt-BR:         Dó Ré Mi Fá Sol Lá Si  (com # ou b, oitava opcional: Sol4)
//   duração opcional:      C4:2  (2 tempos)   E:0.5
//   pausa:                 -  ou  _  ou  R
//   quebra de frase:       |  ou linha vazia

const LETTER_SEMITONE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

const SOLFEGE: [RegExp, number][] = [
  [/^d[oó]/i, 0],
  [/^r[eé]/i, 2],
  [/^mi/i, 4],
  [/^f[aá]/i, 5],
  [/^sol?/i, 7],
  [/^l[aá]/i, 9],
  [/^si/i, 11],
]

const DEFAULT_OCTAVE = 5

/** Uma ou mais notas maiúsculas no estilo noobnotes, possivelmente grudadas: ^C^C, B-^D, .G */
export const NOOBNOTES_TOKEN = /^(?:[.^]*[A-G](?:#|b)?-*)+$/
const NOOBNOTES_NOTE = /([.^]*)([A-G])(#|b)?(-*)/g

export interface ParseResult {
  items: MelodyItem[]
  /** Pedaços do texto que não foram entendidos. */
  unknown: string[]
}

export function parseText(text: string): ParseResult {
  const items: MelodyItem[] = []
  const unknown: string[] = []

  const pushBreak = () => {
    const last = items[items.length - 1]
    if (items.length > 0 && last.kind !== 'break') items.push({ kind: 'break' })
  }

  const lines = text.replace(/\r/g, '').split('\n')
  for (const line of lines) {
    if (line.trim() === '') {
      pushBreak()
      continue
    }
    // Separa "|" como token próprio; vírgulas e parênteses viram espaço.
    const tokens = line
      .replace(/\|/g, ' | ')
      .replace(/[,()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)

    for (const token of tokens) {
      if (token === '|') {
        pushBreak()
        continue
      }
      if (NOOBNOTES_TOKEN.test(token)) {
        items.push(...parseNoobnotes(token))
        continue
      }
      const parsed = parseToken(token)
      if (parsed) items.push(parsed)
      else unknown.push(token)
    }
    pushBreak()
  }

  if (items[items.length - 1]?.kind === 'break') items.pop()
  return { items, unknown }
}

function parseNoobnotes(token: string): MelodyItem[] {
  const notes: MelodyItem[] = []
  for (const m of token.matchAll(NOOBNOTES_NOTE)) {
    const [, marks, letter, acc, dashes] = m
    const shift = (marks.match(/\^/g)?.length ?? 0) - (marks.match(/\./g)?.length ?? 0)
    let semitone = LETTER_SEMITONE[letter.toLowerCase()]
    if (acc === '#') semitone += 1
    if (acc === 'b') semitone -= 1
    notes.push({ kind: 'note', midi: (DEFAULT_OCTAVE + 1 + shift) * 12 + semitone, dur: 1 + dashes.length })
  }
  return notes
}

function parseToken(raw: string): MelodyItem | null {
  let token = raw
  let dur = 1

  const durMatch = token.match(/^(.*?):(\d+(?:[.,]\d+)?)$/)
  if (durMatch) {
    token = durMatch[1]
    dur = parseFloat(durMatch[2].replace(',', '.'))
  }

  if (/^(-|_|r|rest|pausa)$/i.test(token)) return { kind: 'note', midi: null, dur }

  // Pontos antes (oitava abaixo) e apóstrofos/aspas depois (oitava acima).
  let octaveShift = 0
  const dots = token.match(/^\.+/)
  if (dots) {
    octaveShift -= dots[0].length
    token = token.slice(dots[0].length)
  }
  const ticks = token.match(/['’*^]+$/)
  if (ticks) {
    octaveShift += ticks[0].length
    token = token.slice(0, -ticks[0].length)
  }

  let semitone: number | null = null
  let rest = ''

  const solfege = SOLFEGE.find(([re]) => re.test(token))
  const letter = token.match(/^([a-gA-G])(.*)$/)
  if (solfege && token.length >= 2) {
    const m = token.match(solfege[0])!
    semitone = solfege[1]
    rest = token.slice(m[0].length)
  } else if (letter) {
    semitone = LETTER_SEMITONE[letter[1].toLowerCase()]
    rest = letter[2]
  } else {
    return null
  }

  const accMatch = rest.match(/^(#|♯|b|♭)?(-?\d)?$/)
  if (!accMatch) return null
  const acc = accMatch[1]
  if (acc === '#' || acc === '♯') semitone += 1
  if (acc === 'b' || acc === '♭') semitone -= 1
  const octave = accMatch[2] !== undefined ? parseInt(accMatch[2], 10) : DEFAULT_OCTAVE

  const midi = (octave + 1) * 12 + semitone + octaveShift * 12
  return { kind: 'note', midi, dur }
}
