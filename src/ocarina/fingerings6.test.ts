import { describe, expect, it } from 'vitest'
import { parseText } from '../music/parseText'
import { applyTranspose, bestTranspose, scoreShift } from '../music/transpose'
import { isNote } from '../music/types'
import { fingering6For, HOLE6_IDS, OCARINA6_HIGH, OCARINA6_LOW, type Hole6Id } from './fingerings6'
import { OCARINA_6 } from './instruments'

const openHoles = (midi: number) => HOLE6_IDS.filter((h) => !fingering6For(midi)![h])

describe('fingerings 6 furos em Dó', () => {
  it('escala de Dó5 a Mi6 da tabela, abrindo furos aos poucos', () => {
    const naturals = [72, 74, 76, 77, 79, 81, 83, 84, 86, 88]
    for (const m of naturals) expect(fingering6For(m)).not.toBeNull()
    expect(openHoles(72)).toEqual([])
    expect(openHoles(88)).toEqual(HOLE6_IDS)
    // Mais furos abertos (ou furo maior) conforme sobe: a contagem nunca diminui.
    const counts = naturals.map((m) => openHoles(m).length)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
  })

  it('dedilhados conferidos com a tabela da LMS', () => {
    const same = (midi: number, holes: Hole6Id[]) => expect(openHoles(midi).sort()).toEqual([...holes].sort())
    same(74, ['SU'])
    same(76, ['SL'])
    same(77, ['SU', 'SL'])
    same(78, ['BU'])
    same(79, ['BU', 'SU'])
    same(81, ['BU', 'SU', 'SL'])
    same(82, ['BU', 'BL', 'SU'])
    same(83, ['BU', 'BL', 'SL'])
    same(86, ['BU', 'BL', 'SU', 'SL', 'TR'])
  })

  it('fora da extensão e sem dedilhado não sai', () => {
    expect(fingering6For(OCARINA6_LOW - 1)).toBeNull()
    expect(fingering6For(OCARINA6_HIGH + 1)).toBeNull()
    for (const m of [73, 75, 85, 87]) expect(OCARINA_6.cost(m)).toBeNull()
  })

  it('Brilha Brilha Estrelinha em Dó4 vai inteira para a 6 furos', () => {
    const items = parseText('C4 C4 G4 G4 A4 A4 G4:2 | F4 F4 E4 E4 D4 D4 C4:2').items
    const shift = bestTranspose(items, OCARINA_6)
    expect(shift).toBe(12)
    expect(scoreShift(items, shift, OCARINA_6)).toMatchObject({ outOfRange: 0, accidentals: 0 })
    for (const n of applyTranspose(items, shift).filter(isNote)) expect(fingering6For(n.midi)).not.toBeNull()
  })
})
