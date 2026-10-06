import { OCARINA_12, type Instrument } from '../ocarina/instruments'
import { isNote, type MelodyItem } from './types'

/** Extensão da ocarina de 12 furos Alto C (escrita): Lá4 (A4 = 69) até Fá6 (F6 = 89). */
export const OCARINA_LOW = OCARINA_12.low
export const OCARINA_HIGH = OCARINA_12.high

export interface TransposeScore {
  shift: number
  /** Notas que não saem na ocarina (fora da extensão ou sem dedilhado). */
  outOfRange: number
  /** Notas com dedilhado cruzado ou menos confiável. */
  accidentals: number
}

export function applyTranspose(items: MelodyItem[], shift: number): MelodyItem[] {
  if (shift === 0) return items
  return items.map((it) => (isNote(it) ? { ...it, midi: it.midi + shift } : it))
}

export function scoreShift(items: MelodyItem[], shift: number, inst: Instrument = OCARINA_12): TransposeScore {
  let outOfRange = 0
  let accidentals = 0
  for (const it of items) {
    if (!isNote(it)) continue
    const cost = inst.cost(it.midi + shift)
    if (cost === null) outOfRange++
    else if (cost > 0) accidentals++
  }
  return { shift, outOfRange, accidentals }
}

/**
 * Escolhe o melhor deslocamento entre -24 e +24 semitons:
 * 1º menos notas que não saem, 2º menos dedilhados cruzados, 3º menor deslocamento.
 */
export function bestTranspose(items: MelodyItem[], inst: Instrument = OCARINA_12): number {
  if (!items.some(isNote)) return 0
  let best: TransposeScore | null = null
  for (let shift = -24; shift <= 24; shift++) {
    const s = scoreShift(items, shift, inst)
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
