import { Midi } from '@tonejs/midi'
import { describe, expect, it } from 'vitest'
import { readMidi, trackToMelody } from './parseMidi'
import { isNote } from './types'

function buildMidi() {
  const midi = new Midi()
  const ppq = midi.header.ppq
  midi.header.setTempo(90)

  // Trilha 0: acompanhamento grave em acordes
  const bass = midi.addTrack()
  bass.name = 'Piano LH'
  for (let bar = 0; bar < 4; bar++) {
    for (const p of [48, 52, 55]) bass.addNote({ midi: p, ticks: bar * 4 * ppq, durationTicks: 4 * ppq })
  }

  // Trilha 1: melodia com um acorde (fica a nota mais aguda) e uma pausa
  const lead = midi.addTrack()
  lead.name = 'Melodia'
  const seq: [number, number, number][] = [
    // [midi, início em tempos, duração em tempos]
    [72, 0, 1], [74, 1, 1], [76, 2, 2],
    [79, 4, 1], [67, 4, 1], // simultâneas: fica 79
    [77, 5, 1], [76, 7, 1], // pausa de 1 tempo entre 6 e 7
    [74, 8, 4],
  ]
  for (const [m, start, dur] of seq) lead.addNote({ midi: m, ticks: start * ppq, durationTicks: dur * ppq })

  // Trilha 2: bateria
  const drums = midi.addTrack()
  drums.channel = 9
  for (let i = 0; i < 16; i++) drums.addNote({ midi: 36, ticks: i * ppq, durationTicks: ppq / 2 })

  return midi.toArray()
}

describe('parseMidi', () => {
  it('lê trilhas, andamento e sugere a melodia', () => {
    const info = readMidi(buildMidi())
    expect(info.tracks).toHaveLength(3)
    expect(info.bpm).toBe(90)
    expect(info.tracks[2].isDrum).toBe(true)
    expect(info.suggested).toBe(1)
    expect(info.totalBars).toBe(4)
  })

  it('gera melodia monofônica com pausas e durações', () => {
    const info = readMidi(buildMidi())
    const items = trackToMelody(info, 1)
    const notes = items.filter(isNote).map((n) => `${n.midi}:${n.dur}`)
    expect(notes).toEqual(['72:1', '74:1', '76:2', '79:1', '77:1', '76:1', '74:4'])
    expect(items.some((i) => i.kind === 'note' && i.midi === null && i.dur === 1)).toBe(true)
  })

  it('recorta por compassos', () => {
    const info = readMidi(buildMidi())
    const notes = trackToMelody(info, 1, { fromBar: 2, toBar: 2 }).filter(isNote)
    expect(notes.map((n) => n.midi)).toEqual([79, 77, 76])
  })
})
