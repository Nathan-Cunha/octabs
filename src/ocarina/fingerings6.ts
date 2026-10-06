// Dedilhados da ocarina de 6 furos em Dó (pingente, sistema inglês + 2 polegares).
// Conferido com a tabela "6 Hole Ocarina Fingering Chart" da LMS que veio com a ocarina:
// pauta azul = escala de Dó, verde = escala de Fá (dá o Si♭), roxa = escala de Sol (dá o Fá#).
//
// Na frente: dois furos grandes (mão esquerda) e dois pequenos (mão direita);
// atrás: dois furos de polegar. Nomes pela posição na figurinha da tabela:
// BU / BL = grande de cima / de baixo; SU / SL = pequeno de cima / de baixo;
// TL / TR = polegar à esquerda / à direita do bocal.

export type Hole6Id = 'BU' | 'BL' | 'SU' | 'SL' | 'TL' | 'TR'

/** true = furo tampado. */
export type Fingering6 = Record<Hole6Id, boolean>

export const HOLE6_IDS: Hole6Id[] = ['BU', 'BL', 'SU', 'SL', 'TL', 'TR']

const FRONT: Hole6Id[] = ['BU', 'BL', 'SU', 'SL']

/** Furos ABERTOS por nota (número MIDI, C5 = 72). */
const OPEN: Record<number, Hole6Id[]> = {
  72: [], // C5  tudo tampado
  74: ['SU'], // D5
  76: ['SL'], // E5
  77: ['SU', 'SL'], // F5
  78: ['BU'], // F#5 (pauta roxa)
  79: ['BU', 'SU'], // G5
  80: ['BU', 'SL'], // G#5 deduzido: fica entre Sol e Lá; não aparece na tabela
  81: ['BU', 'SU', 'SL'], // A5
  82: ['BU', 'BL', 'SU'], // A#5 / Si♭ (pauta verde)
  83: ['BU', 'BL', 'SL'], // B5
  84: [...FRONT], // C6  frente toda aberta
  86: [...FRONT, 'TR'], // D6  só o polegar esquerdo tampado
  88: [...HOLE6_IDS], // E6  tudo aberto
}

/** Notas que não estão na tabela e foram deduzidas (dedilhado menos confiável). */
export const DERIVED6 = new Set([80])

export const OCARINA6_LOW = 72
export const OCARINA6_HIGH = 88

export function fingering6For(midi: number): Fingering6 | null {
  const open = OPEN[midi]
  if (!open) return null
  return Object.fromEntries(HOLE6_IDS.map((id) => [id, !open.includes(id)])) as Fingering6
}
