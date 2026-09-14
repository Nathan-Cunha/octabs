import { isNote, type MelodyItem } from './types'

/** Extensão da ocarina de 12 furos Alto C (escrita): Lá4 (A4 = 69) até Fá6 (F6 = 89). */
export const OCARINA_LOW = 69
export const OCARINA_HIGH = 89

/** Classes de altura que exigem dedilhado cruzado (acidentes, fora Lá# grave via sub-hole). */
const ACCIDENTAL_PCS = new Set([1, 3, 6, 8, 10])

export interface TransposeScore {
  shift: number
  outOfRange: number
  accidentals: number
}

export function applyTranspose(items: MelodyItem[], shift: number): MelodyItem[] {
  if (shift === 0) return items
  return items.map((it) => (isNote(it) ? { ...it, midi: it.midi + shift } : it))
}

export function scoreShift(items: MelodyItem[], shift: number): TransposeScore {
  let outOfRange = 0
  let accidentals = 0
  for (const it of items) {
    if (!isNote(it)) continue
    const m = it.midi + shift
    if (m < OCARINA_LOW || m > OCARINA_HIGH) outOfRange++
    // Lá#4 (70) sai com sub-hole, não conta como cruzado.
    else if (ACCIDENTAL_PCS.has(m % 12) && m !== 70) accidentals++
  }
  return { shift, outOfRange, accidentals }
}

/**
 * Escolhe o melhor deslocamento entre -24 e +24 semitons:
 * 1º menos notas fora da extensão, 2º menos dedilhados cruzados, 3º menor deslocamento.
 */
export function bestTranspose(items: MelodyItem[]): number {
  if (!items.some(isNote)) return 0
  let best: TransposeScore | null = null
  for (let shift = -24; shift <= 24; shift++) {
    const s = scoreShift(items, shift)
    if (
      !best ||
      s.outOfRange < best.outOfRange ||
      (s.outOfRange === best.outOfRange && s.accidentals < best.accidentals) ||
      (s.outOfRange === best.outOfRange &&
        s.accidentals === best.accidentals &&
        Math.abs(s.shift) < Math.abs(best.shift))
    ) {
      best = s
    }
  }
  return best!.shift
}
