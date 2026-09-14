import type { Fingering, HoleId } from './fingerings'

// Figurinha no estilo das tabelas da STL (o mesmo da imagem de referência):
// corpo inclinado com a ponta para cima à direita, mão esquerda na parte arredondada,
// mão direita subindo pela ponta, sub-holes pequenos ao lado dos dedos médios
// e os dois polegares abaixo do corpo. Preto = tampado.

const BIG = 12
const SMALL = 6.5

const HOLES: Record<HoleId, { x: number; y: number; r: number }> = {
  L1: { x: 42, y: 157, r: BIG },
  L2: { x: 72, y: 145, r: BIG },
  L3: { x: 95, y: 123, r: BIG },
  L4: { x: 107, y: 91, r: BIG },
  LS: { x: 91, y: 165, r: SMALL },
  R1: { x: 162, y: 137, r: BIG },
  R2: { x: 173, y: 103, r: BIG },
  R3: { x: 195, y: 78, r: BIG },
  R4: { x: 225, y: 62, r: BIG },
  RS: { x: 150, y: 85, r: SMALL },
  LT: { x: 97, y: 225, r: BIG },
  RT: { x: 191, y: 192, r: BIG },
}

const BODY =
  'M 4 162 C -2 135 40 100 105 72 C 160 50 230 25 262 12 C 280 5 290 16 281 29 ' +
  'C 250 75 210 130 180 200 C 170 222 168 240 158 244 C 146 248 138 236 130 222 ' +
  'C 120 204 108 198 80 196 L 38 193 C 18 191 8 180 4 162 Z'

interface Props {
  fingering: Fingering | null
  label?: string
  highlight?: boolean
  outOfRange?: boolean
}

export function OcarinaSvg({ fingering, label, highlight, outOfRange }: Props) {
  return (
    <figure className={`ocarina${highlight ? ' is-current' : ''}${outOfRange ? ' is-out' : ''}`}>
      <svg viewBox="-6 0 300 250" role="img" aria-label={label ?? 'nota'}>
        <path d={BODY} className="ocarina-body" />
        {fingering ? (
          (Object.keys(HOLES) as HoleId[]).map((id) => {
            const h = HOLES[id]
            return (
              <circle
                key={id}
                cx={h.x}
                cy={h.y}
                r={h.r}
                className={fingering[id] ? 'hole closed' : 'hole open'}
              />
            )
          })
        ) : (
          <text x="140" y="150" textAnchor="middle" className="ocarina-missing">
            ?
          </text>
        )}
      </svg>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
