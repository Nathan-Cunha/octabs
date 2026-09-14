import { describe, expect, it } from 'vitest'
import { OCARINA_HIGH, OCARINA_LOW } from '../music/transpose'
import { fingeringFor, HOLE_IDS, type HoleId } from './fingerings'

const closedCount = (midi: number) => HOLE_IDS.filter((h) => fingeringFor(midi)![h]).length
const openHoles = (midi: number) => HOLE_IDS.filter((h) => !fingeringFor(midi)![h])

describe('fingerings 12 furos Alto C', () => {
  it('toda nota de A4 a F6 tem dedilhado, e fora disso não', () => {
    for (let m = OCARINA_LOW; m <= OCARINA_HIGH; m++) expect(fingeringFor(m)).not.toBeNull()
    expect(fingeringFor(OCARINA_LOW - 1)).toBeNull()
    expect(fingeringFor(OCARINA_HIGH + 1)).toBeNull()
  })

  it('escala natural abre furos progressivamente', () => {
    const naturals = [69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89]
    const counts = naturals.map(closedCount)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1])
    expect(counts[0]).toBe(12)
    expect(counts[counts.length - 1]).toBe(0)
  })

  it('dedilhados conferidos com as tabelas', () => {
    const same = (midi: number, holes: HoleId[]) => expect(openHoles(midi).sort()).toEqual([...holes].sort())
    same(70, ['RS'])
    same(71, ['LS'])
    same(73, ['LS', 'R4'])
    same(78, ['LS', 'RS', 'R4', 'R2', 'R1'])
    same(84, ['LS', 'RS', 'R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'L3'])
    same(88, ['LS', 'RS', 'R1', 'R2', 'R3', 'R4', 'L1', 'L2', 'L3', 'LT', 'RT'])
  })
})
