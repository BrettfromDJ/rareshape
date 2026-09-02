'use client'

/**
 * Every cue is synthesized with the Web Audio API, so there are no audio files
 * to load and nothing to download. The context is created on the first cue,
 * which only ever follows a click or key press, so nothing plays before the
 * host has interacted with the page.
 */

export type Cue =
  | 'correct'
  | 'incorrect'
  | 'warning'
  | 'expired'
  | 'steal'
  | 'round'
  | 'winner'
  | 'token'
  | 'reveal'
  | 'tick'

let context: AudioContext | null = null

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Prepares the audio context inside a user gesture, so later cues are instant. */
export function primeAudio(): void {
  ensure()
}

interface Note {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
}

function play(notes: Note[], master = 0.6): void {
  const ctx = ensure()
  if (!ctx) return
  const now = ctx.currentTime
  const bus = ctx.createGain()
  bus.gain.value = master
  bus.connect(ctx.destination)
  for (const note of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(note.freq, now + note.at)
    if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, now + note.at + note.dur)
    const peak = note.gain ?? 0.5
    gain.gain.setValueAtTime(0.0001, now + note.at)
    gain.gain.exponentialRampToValueAtTime(peak, now + note.at + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur)
    osc.connect(gain)
    gain.connect(bus)
    osc.start(now + note.at)
    osc.stop(now + note.at + note.dur + 0.05)
  }
}

const CUES: Record<Cue, () => void> = {
  correct: () =>
    play([
      { freq: 1046.5, at: 0, dur: 0.9, gain: 0.5 },
      { freq: 2093, at: 0, dur: 0.6, gain: 0.18 },
      { freq: 1318.5, at: 0.09, dur: 1.1, gain: 0.45 },
      { freq: 3136, at: 0.09, dur: 0.4, gain: 0.08, type: 'triangle' },
    ]),
  incorrect: () =>
    play(
      [
        { freq: 110, at: 0, dur: 0.55, type: 'sawtooth', gain: 0.5 },
        { freq: 82.4, at: 0, dur: 0.55, type: 'square', gain: 0.25 },
        { freq: 116, at: 0, dur: 0.55, type: 'sawtooth', gain: 0.3 },
      ],
      0.45,
    ),
  warning: () => play([{ freq: 1200, at: 0, dur: 0.08, type: 'square', gain: 0.25 }], 0.4),
  tick: () => play([{ freq: 900, at: 0, dur: 0.05, type: 'square', gain: 0.15 }], 0.3),
  expired: () =>
    play(
      [
        { freq: 660, at: 0, dur: 0.2, type: 'square', gain: 0.35 },
        { freq: 440, at: 0.2, dur: 0.25, type: 'square', gain: 0.35 },
        { freq: 220, at: 0.45, dur: 0.6, type: 'sawtooth', gain: 0.4, slideTo: 110 },
      ],
      0.5,
    ),
  steal: () =>
    play([
      { freq: 300, at: 0, dur: 0.35, type: 'sawtooth', gain: 0.3, slideTo: 900 },
      { freq: 300, at: 0.18, dur: 0.35, type: 'sawtooth', gain: 0.3, slideTo: 1200 },
      { freq: 1200, at: 0.5, dur: 0.15, type: 'square', gain: 0.25 },
      { freq: 1500, at: 0.62, dur: 0.25, type: 'square', gain: 0.25 },
    ]),
  round: () =>
    play([
      { freq: 523.25, at: 0, dur: 0.2, type: 'triangle', gain: 0.5 },
      { freq: 659.25, at: 0.18, dur: 0.2, type: 'triangle', gain: 0.5 },
      { freq: 783.99, at: 0.36, dur: 0.2, type: 'triangle', gain: 0.5 },
      { freq: 1046.5, at: 0.54, dur: 0.8, type: 'triangle', gain: 0.55 },
      { freq: 523.25, at: 0.54, dur: 0.8, type: 'sine', gain: 0.25 },
    ]),
  winner: () =>
    play([
      { freq: 523.25, at: 0, dur: 0.18, type: 'square', gain: 0.3 },
      { freq: 523.25, at: 0.2, dur: 0.18, type: 'square', gain: 0.3 },
      { freq: 523.25, at: 0.4, dur: 0.18, type: 'square', gain: 0.3 },
      { freq: 659.25, at: 0.6, dur: 0.5, type: 'square', gain: 0.32 },
      { freq: 587.33, at: 1.05, dur: 0.18, type: 'square', gain: 0.3 },
      { freq: 659.25, at: 1.25, dur: 0.18, type: 'square', gain: 0.3 },
      { freq: 783.99, at: 1.45, dur: 1.2, type: 'square', gain: 0.35 },
      { freq: 1046.5, at: 1.45, dur: 1.2, type: 'triangle', gain: 0.35 },
      { freq: 261.63, at: 1.45, dur: 1.2, type: 'sine', gain: 0.3 },
    ]),
  token: () =>
    play([
      { freq: 400, at: 0, dur: 0.5, type: 'square', gain: 0.25, slideTo: 1600 },
      { freq: 800, at: 0.1, dur: 0.5, type: 'triangle', gain: 0.25, slideTo: 3200 },
      { freq: 2400, at: 0.5, dur: 0.3, type: 'sine', gain: 0.3 },
    ]),
  reveal: () =>
    play([
      { freq: 880, at: 0, dur: 0.12, type: 'triangle', gain: 0.3 },
      { freq: 1174.7, at: 0.1, dur: 0.3, type: 'triangle', gain: 0.3 },
    ]),
}

export function playCue(cue: Cue, muted: boolean): void {
  if (muted) return
  try {
    CUES[cue]()
  } catch {
    // Audio is a nicety: a browser without it still runs the game.
  }
}

/** Reads the word aloud with the browser's speech engine, if it has one. */
export function speak(text: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.8
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}
