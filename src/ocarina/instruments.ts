import { fingeringFor } from './fingerings'
import { DERIVED6, fingering6For, OCARINA6_HIGH, OCARINA6_LOW } from './fingerings6'

export type InstrumentId = '12' | '6'

export interface Instrument {
  id: InstrumentId
  name: string
  low: number
  high: number
  /** Furos tampados (true) por id, ou null se a nota não sai nessa ocarina. */
  fingering(midi: number): Record<string, boolean> | null
  /** 0 = dedilhado simples, 1 = cruzado/deduzido, null = não sai nessa ocarina. */
  cost(midi: number): number | null
}

/** Classes de altura que exigem dedilhado cruzado na de 12 furos. */
const ACCIDENTAL_PCS = new Set([1, 3, 6, 8, 10])

export const OCARINA_12: Instrument = {
  id: '12',
  name: '12 furos',
  low: 69,
  high: 89,
  fingering: fingeringFor,
  cost(midi) {
    if (!fingeringFor(midi)) return null
    // Lá#4 (70) sai com sub-hole, não conta como cruzado.
    return ACCIDENTAL_PCS.has(midi % 12) && midi !== 70 ? 1 : 0
  },
}

export const OCARINA_6: Instrument = {
  id: '6',
  name: '6 furos',
  low: OCARINA6_LOW,
  high: OCARINA6_HIGH,
  fingering: fingering6For,
  cost(midi) {
    if (!fingering6For(midi)) return null
    return DERIVED6.has(midi) ? 1 : 0
  },
}

export const INSTRUMENTS: Instrument[] = [OCARINA_12, OCARINA_6]

export function getInstrument(id: InstrumentId | undefined): Instrument {
  return id === '6' ? OCARINA_6 : OCARINA_12
}
