export const DISTRACTIONS: string[] = [
  'Spin around five times, then spell',
  'Wear oven mitts while spelling',
  'Balance a cup on your head',
  'Hold an ice cube the whole time',
  'Do jumping jacks while spelling',
  'Spell it in a British accent',
  'Stand on one leg',
  'Wear headphones with music playing',
  'Another team gets to heckle you',
  'Spell with a cracker in your mouth',
  'Spell it backwards-facing, to the wall',
  'Spell every letter as a question',
  'Whisper the whole thing',
  'Spell it like a sports announcer',
  'Do a lunge on every vowel',
]

export function pickDistraction(avoid: string | null): string {
  const pool = DISTRACTIONS.filter((item) => item !== avoid)
  const index = Math.floor(Math.random() * pool.length)
  return pool[index] ?? DISTRACTIONS[0] ?? 'Spell it with feeling'
}
