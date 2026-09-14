import { isNote, type MelodyItem } from '../music/types'

// Som simples parecido com ocarina: senoide + um pouco de 2º harmônico, ataque e soltura suaves.

let ctx: AudioContext | null = null
const audio = () => (ctx ??= new AudioContext())

const midiToHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

export interface PlayHandle {
  stop(): void
}

/**
 * Toca a melodia. onStep recebe o índice do item atual (ou -1 ao terminar).
 * `from` permite começar de uma nota específica.
 */
export function playMelody(
  items: MelodyItem[],
  bpm: number,
  onStep: (index: number) => void,
  from = 0,
): PlayHandle {
  const ac = audio()
  void ac.resume()
  const beat = 60 / bpm
  const start = ac.currentTime + 0.08
  const master = ac.createGain()
  master.gain.value = 0.25
  master.connect(ac.destination)

  const timers: number[] = []
  let t = 0
  for (let i = from; i < items.length; i++) {
    const it = items[i]
    if (it.kind === 'break') continue
    const dur = it.dur * beat
    const at = start + t
    timers.push(window.setTimeout(() => onStep(i), (at - ac.currentTime) * 1000))

    if (isNote(it)) {
      const f = midiToHz(it.midi)
      const env = ac.createGain()
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(1, at + 0.03)
      env.gain.setValueAtTime(1, at + Math.max(0.04, dur - 0.08))
      env.gain.linearRampToValueAtTime(0, at + dur - 0.01)
      env.connect(master)

      const o1 = ac.createOscillator()
      o1.frequency.value = f
      o1.connect(env)
      const h2 = ac.createGain()
      h2.gain.value = 0.08
      const o2 = ac.createOscillator()
      o2.frequency.value = f * 2
      o2.connect(h2).connect(env)
      for (const o of [o1, o2]) {
        o.start(at)
        o.stop(at + dur)
      }
    }
    t += dur
  }
  timers.push(window.setTimeout(() => onStep(-1), (start + t - ac.currentTime) * 1000))

  return {
    stop() {
      timers.forEach(clearTimeout)
      master.gain.cancelScheduledValues(ac.currentTime)
      master.gain.setValueAtTime(0, ac.currentTime)
      master.disconnect()
      onStep(-1)
    },
  }
}

/** Toca uma nota isolada (ao tocar numa figurinha). */
export function playNote(midi: number, seconds = 0.5) {
  playMelody([{ kind: 'note', midi, dur: 1 }], 60 / seconds, () => {})
}
