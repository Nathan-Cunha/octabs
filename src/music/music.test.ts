import { describe, expect, it } from 'vitest'
import { parseText } from './parseText'
import { applyTranspose, bestTranspose, OCARINA_HIGH, OCARINA_LOW, scoreShift } from './transpose'
import { isNote, midiToName } from './types'

const midis = (text: string) => parseText(text).items.filter(isNote).map((n) => n.midi)

describe('parseText', () => {
  it('letras com oitava e acidentes', () => {
    expect(midis('C4 D#4 Eb5 B5')).toEqual([60, 63, 75, 83])
  })

  it('letras sem oitava usam a 5ª oitava', () => {
    expect(midis('C D E F G A B')).toEqual([72, 74, 76, 77, 79, 81, 83])
  })

  it('estilo noobnotes com ponto e apóstrofo', () => {
    expect(midis(".G C D E'")).toEqual([67, 72, 74, 88])
  })

  it('solfejo pt-BR', () => {
    expect(midis('Dó Ré Mi Fá Sol Lá Si')).toEqual([72, 74, 76, 77, 79, 81, 83])
    expect(midis('Sol4 Lá4 Fá#5 Sib5')).toEqual([67, 69, 78, 82])
  })

  it('duração, pausa e quebra de frase', () => {
    const { items, unknown } = parseText('C:2 - D | E\n\nF')
    expect(unknown).toEqual([])
    expect(items.map((i) => (i.kind === 'break' ? '|' : `${i.midi ?? 'r'}:${i.dur}`))).toEqual([
      '72:2', 'r:1', '74:1', '|', '76:1', '|', '77:1',
    ])
  })

  it('reporta tokens desconhecidos', () => {
    expect(parseText('C xyz D').unknown).toEqual(['xyz'])
  })

  it('Asa Branca (início) em solfejo', () => {
    // "Quando olhei a terra ardendo"
    expect(midis('Dó4 Ré4 Mi4 Sol4 Sol4 Mi4 Fá4 Fá4')).toEqual([60, 62, 64, 67, 67, 64, 65, 65])
  })
})

describe('transpose', () => {
  it('Noite Feliz em Dó4 cabe inteira após transpor', () => {
    const items = parseText('G4:1.5 A4:0.5 G4 E4:3 | G4:1.5 A4:0.5 G4 E4:3 | D5:2 D5 B4:3 | C5:2 C5 G4:3').items
    const shift = bestTranspose(items)
    expect(scoreShift(items, shift).outOfRange).toBe(0)
    for (const n of applyTranspose(items, shift).filter(isNote)) {
      expect(n.midi).toBeGreaterThanOrEqual(OCARINA_LOW)
      expect(n.midi).toBeLessThanOrEqual(OCARINA_HIGH)
    }
  })

  it('melodia já na extensão e sem acidentes não é transposta', () => {
    expect(bestTranspose(parseText('C5 D5 E5 F5 G5').items)).toBe(0)
  })

  it('midiToName', () => {
    expect(midiToName(69)).toBe('A4')
    expect(midiToName(78, 'pt')).toBe('Fá#5')
  })
})
