import type { InstrumentId } from './instruments'

interface Hole {
  x: number
  y: number
  r: number
}

interface Shape {
  viewBox: string
  /** Rotação do desenho inteiro (graus, em torno de cx/cy). */
  rotate?: { deg: number; cx: number; cy: number }
  /** Contornos do corpo, desenhados em ordem (o último fica por cima). */
  body: string[]
  holes: Record<string, Hole>
  missingAt: { x: number; y: number }
}

// 12 furos: figurinha no estilo das tabelas da STL (o mesmo da imagem de referência):
// corpo inclinado com a ponta para cima à direita, mão esquerda na parte arredondada,
// mão direita subindo pela ponta, sub-holes pequenos ao lado dos dedos médios
// e os dois polegares abaixo do corpo. Preto = tampado.
const BIG = 12
const SMALL = 6.5

const SHAPE_12: Shape = {
  viewBox: '-6 0 300 250',
  body: [
    'M 4 162 C -2 135 40 100 105 72 C 160 50 230 25 262 12 C 280 5 290 16 281 29 ' +
      'C 250 75 210 130 180 200 C 170 222 168 240 158 244 C 146 248 138 236 130 222 ' +
      'C 120 204 108 198 80 196 L 38 193 C 18 191 8 180 4 162 Z',
  ],
  holes: {
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
  },
  missingAt: { x: 140, y: 150 },
}

// 6 furos: como na tabela da LMS — corpo oval levemente inclinado, bocal para baixo,
// dois furos grandes empilhados, dois pequenos à direita e os polegares (de trás)
// como bolinhas dos dois lados do bocal.
const SHAPE_6: Shape = {
  viewBox: '0 0 300 250',
  rotate: { deg: -10, cx: 150, cy: 125 },
  body: [
    'M 122 160 L 132 236 Q 150 248 168 236 L 180 160 Z',
    'M 8 118 C -2 58 62 14 152 12 C 242 10 300 32 294 74 C 288 118 226 176 150 182 ' +
      'C 70 188 18 164 8 118 Z',
  ],
  holes: {
    BU: { x: 122, y: 64, r: 27 },
    BL: { x: 114, y: 130, r: 27 },
    SU: { x: 204, y: 56, r: 15 },
    SL: { x: 214, y: 106, r: 15 },
    TL: { x: 92, y: 218, r: 15 },
    TR: { x: 210, y: 218, r: 15 },
  },
  missingAt: { x: 150, y: 118 },
}

const SHAPES: Record<InstrumentId, Shape> = { '12': SHAPE_12, '6': SHAPE_6 }

interface Props {
  instrument?: InstrumentId
  fingering: Record<string, boolean> | null
  label?: string
  highlight?: boolean
  outOfRange?: boolean
}

export function OcarinaSvg({ instrument = '12', fingering, label, highlight, outOfRange }: Props) {
  const shape = SHAPES[instrument]
  const rot = shape.rotate
  return (
    <figure className={`ocarina${highlight ? ' is-current' : ''}${outOfRange ? ' is-out' : ''}`}>
      <svg viewBox={shape.viewBox} role="img" aria-label={label ?? 'nota'}>
        <g transform={rot ? `rotate(${rot.deg} ${rot.cx} ${rot.cy})` : undefined}>
          {shape.body.map((d, i) => (
            <path key={i} d={d} className="ocarina-body" />
          ))}
          {fingering &&
            Object.entries(shape.holes).map(([id, h]) => (
              <circle
                key={id}
                cx={h.x}
                cy={h.y}
                r={h.r}
                className={fingering[id] ? 'hole closed' : 'hole open'}
              />
            ))}
        </g>
        {!fingering && (
          <text x={shape.missingAt.x} y={shape.missingAt.y} textAnchor="middle" className="ocarina-missing">
            ?
          </text>
        )}
      </svg>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
