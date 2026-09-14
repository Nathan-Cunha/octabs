// Dedilhados da ocarina de 12 furos Alto C (sistema taiwanês / Noble / STL).
// Conferido com as tabelas da STL Ocarina e da Imperial City Ocarina.
//
// L1..L4 = indicador..mínimo da mão esquerda; R1..R4 = mão direita;
// LS / RS = sub-holes (pequenos) ao lado dos dedos médios; LT / RT = polegares.

export type HoleId = 'L1' | 'L2' | 'L3' | 'L4' | 'R1' | 'R2' | 'R3' | 'R4' | 'LS' | 'RS' | 'LT' | 'RT'

/** true = furo tampado. */
export type Fingering = Record<HoleId, boolean>

export const HOLE_IDS: HoleId[] = ['L1', 'L2', 'L3', 'L4', 'R1', 'R2', 'R3', 'R4', 'LS', 'RS', 'LT', 'RT']

const SUBS: HoleId[] = ['LS', 'RS']
const RIGHT: HoleId[] = ['R1', 'R2', 'R3', 'R4']

/** Furos ABERTOS por nota (número MIDI escrito, A4 = 69). */
const OPEN: Record<number, HoleId[]> = {
  69: [], // A4  tudo tampado
  70: ['RS'], // A#4 só o sub-hole esquerdo tampado
  71: ['LS'], // B4  só o sub-hole direito tampado
  72: [...SUBS], // C5
  73: ['LS', 'R4'], // C#5 = D5 com sub-hole direito tampado
  74: [...SUBS, 'R4'], // D5
  75: ['LS', 'R4', 'R3'], // D#5 = E5 com sub-hole direito tampado
  76: [...SUBS, 'R4', 'R3'], // E5
  77: [...SUBS, 'R4', 'R3', 'R2'], // F5
  78: [...SUBS, 'R4', 'R2', 'R1'], // F#5 = G5 com anelar direito tampado
  79: [...SUBS, ...RIGHT], // G5
  80: [...SUBS, 'R4', 'R2', 'R1', 'L3'], // G#5 = A5 com anelar direito
  81: [...SUBS, ...RIGHT, 'L3'], // A5
  82: [...SUBS, 'R4', 'R2', 'R1', 'L3', 'L2'], // A#5 = B5 com anelar direito
  83: [...SUBS, ...RIGHT, 'L3', 'L2'], // B5
  84: [...SUBS, ...RIGHT, 'L3', 'L2', 'L1'], // C6
  85: [...SUBS, 'R4', 'R2', 'R1', 'L3', 'L2', 'L1', 'LT'], // C#6 = D6 com anelar direito
  86: [...SUBS, ...RIGHT, 'L3', 'L2', 'L1', 'LT'], // D6
  87: [...SUBS, 'R4', 'R2', 'R1', 'L3', 'L2', 'L1', 'LT', 'RT'], // D#6 = E6 com anelar direito
  88: [...SUBS, ...RIGHT, 'L3', 'L2', 'L1', 'LT', 'RT'], // E6
  89: [...HOLE_IDS], // F6  tudo aberto
}

export function fingeringFor(midi: number): Fingering | null {
  const open = OPEN[midi]
  if (!open) return null
  return Object.fromEntries(HOLE_IDS.map((id) => [id, !open.includes(id)])) as Fingering
}
