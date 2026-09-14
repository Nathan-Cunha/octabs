import { midiToName, type MelodyItem, type NoteEvent } from '../music/types'
import { OCARINA_HIGH, OCARINA_LOW } from '../music/transpose'
import { fingeringFor } from '../ocarina/fingerings'
import { OcarinaSvg } from '../ocarina/OcarinaSvg'

interface Props {
  items: MelodyItem[]
  current: number
  showNames: boolean
  lang: 'pt' | 'en'
  onTap(index: number): void
}

export function TabSheet({ items, current, showNames, lang, onTap }: Props) {
  // Agrupa em frases; cada figurinha guarda o índice original para o player.
  const phrases: { note: NoteEvent; index: number }[][] = [[]]
  items.forEach((item, index) => {
    if (item.kind === 'break') {
      if (phrases[phrases.length - 1].length > 0) phrases.push([])
    } else {
      phrases[phrases.length - 1].push({ note: item, index })
    }
  })

  return (
    <div className="tab-sheet">
      {phrases
        .filter((p) => p.length > 0)
        .map((phrase, pi) => (
          <div className="phrase" key={pi}>
            {phrase.map(({ note, index }) => {
              if (note.midi === null) {
                return (
                  <div
                    key={index}
                    className={`ocarina rest${index === current ? ' is-current' : ''}`}
                    onClick={() => onTap(index)}
                  >
                    –
                  </div>
                )
              }
              const out = note.midi < OCARINA_LOW || note.midi > OCARINA_HIGH
              return (
                <div key={index} onClick={() => onTap(index)}>
                  <OcarinaSvg
                    fingering={fingeringFor(note.midi)}
                    label={showNames || out ? midiToName(note.midi, lang) : undefined}
                    highlight={index === current}
                    outOfRange={out}
                  />
                </div>
              )
            })}
          </div>
        ))}
    </div>
  )
}
