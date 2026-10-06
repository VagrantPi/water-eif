export type Day = { totalMl: number; log: { at: number; ml: number }[] }
export type Stats = { goalDays: number; streak: number; lastGoalDay: string }
export type Mood = 'cheer' | 'happy' | 'idle' | 'thirsty' | 'done'

declare module 'claude-code' {
  interface PluginState {
    'water-elf': { today: Day; stats: Stats; mood: Mood }
  }
}
