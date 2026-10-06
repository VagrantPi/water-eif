import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Day, Mood, Stats } from '../types'
import { HEIGHT, PALETTE, SPRITES, WIDTH } from './sprites'

const MINUTE = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE
const FRAME_MS = 150
const HAPPY_MS = 30 * MINUTE
const CHEER_MS = 3000
const ROWS = HEIGHT / 2

export const STAGES = [
  { days: 0, color: 'green', name: '青苔寶寶' },
  { days: 3, color: 'blue', name: '水精靈' },
  { days: 7, color: 'yellow', name: '晨光精靈' },
  { days: 14, color: 'red', name: '珊瑚精靈' },
] as const

const LINES: Record<Mood, string> = {
  cheer: '咕嘟咕嘟～好喝！',
  happy: '水水的好舒服 ✨',
  idle: '在旁邊陪你寫 code',
  thirsty: '好渴…快融化了…',
  done: '今天喝夠了，精靈閃閃發亮 🎉',
}

const ANIM: Record<Mood, 'walk' | 'gesture' | 'idle' | 'death'> = {
  cheer: 'walk',
  happy: 'gesture',
  idle: 'idle',
  thirsty: 'death',
  done: 'walk',
}

const today = atom({ plugin: 'water-elf', key: 'today' } as const, { totalMl: 0, log: [] })
const stats = atom({ plugin: 'water-elf', key: 'stats' } as const, { goalDays: 0, streak: 0, lastGoalDay: '' })
const mood = atom({ plugin: 'water-elf', key: 'mood' } as const, 'idle')
const PANE = 'water-elf'
const PANE_TITLE = '💧 喝水精靈'

// 本機日期，例如 "day:2026-10-06"
export const dayKey = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// "/water" = 1 份，"/water 2" = 2 份，"/water 0.5" = 半份
export const parseServings = (args: string) => {
  const text = args.trim()
  if (text === '') return 1
  const n = Number(text)
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null
}

export const stageOf = (goalDays: number) => [...STAGES].reverse().find(s => goalDays >= s.days) ?? STAGES[0]

// 今天沒喝過就從 session 啟動算起，免得早上一開就是口渴臉
export const moodAt = (now: number, lastAt: number | undefined, startedAt: number, thirstyMs: number): Mood => {
  if (lastAt !== undefined && now - lastAt < HAPPY_MS) return 'happy'
  return now - (lastAt ?? startedAt) >= thirstyMs ? 'thirsty' : 'idle'
}

export const reachGoal = (st: Stats, now: number): Stats => ({
  goalDays: st.goalDays + 1,
  streak: st.lastGoalDay === dayKey(now - DAY_MS) ? st.streak + 1 : 1,
  lastGoalDay: dayKey(now),
})

// 昨天或今天有達標才算連續中
const liveStreak = (st: Stats, now: number) =>
  st.lastGoalDay === dayKey(now) || st.lastGoalDay === dayKey(now - DAY_MS) ? st.streak : 0

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DEFAULT = 0x01000000
const cache = new Map<string, string>()
const pixel = (ch: string | undefined) => (ch === undefined || ch === '.' ? null : (PALETTE[DIGITS.indexOf(ch)] ?? null))

// 一格放上下兩個像素：▀ 前景是上、背景是下；glyphs 只畫在全透明的格子上
const toCells = (cols: number, rows: number, px: (number | null)[], glyphs = new Map<number, [number, number]>()) => {
  const words = new Uint32Array(cols * rows * 3)
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const top = px[2 * cy * cols + cx] ?? null
      const bottom = px[(2 * cy + 1) * cols + cx] ?? null
      const cell = cy * cols + cx
      const glyph = glyphs.get(cell)
      const i = cell * 3
      if (top === null && bottom === null) words.set(glyph ? [glyph[0], glyph[1], DEFAULT] : [0x20, DEFAULT, DEFAULT], i)
      else if (top === null) words.set([0x2584, bottom ?? DEFAULT, DEFAULT], i)
      else words.set([0x2580, top, bottom ?? DEFAULT], i)
    }
  }
  // 執行環境有 Uint8Array#toBase64（ES2026），TS lib 還沒收錄
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
}

export const encode = (frame: string) => {
  const hit = cache.get(frame)
  if (hit) return hit
  const cells = toCells(WIDTH, ROWS, Array.from(frame, pixel))
  cache.set(frame, cells)
  return cells
}

// 達標慶祝：精靈在中間跳、旁邊星星閃、底下兩排水波往左流
export const CELEBRATE_COLS = 22
export const CELEBRATE_ROWS = 10
const SPRITE_X = 4
const WAVE_CREST = 0x9be7ff
const WAVE_DEEP = 0x2f7fd6
const SPARKLE_COLORS = [0xffd75f, 0xfff3b0]
const SPARKLE_CHARS = [0x2726, 0x2727, 0x2b, 0x20] // ✦ ✧ + 空白
const SPARKLES: [number, number][] = [[1, 0], [20, 1], [3, 3], [18, 3], [0, 5], [21, 5], [2, 7], [19, 7]]

export const celebrate = (color: (typeof STAGES)[number]['color'], tick: number) => {
  const cols = CELEBRATE_COLS
  const px: (number | null)[] = new Array(cols * CELEBRATE_ROWS * 2).fill(null)
  const frame = frameOf('done', color, tick)
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const c = pixel(frame[y * WIDTH + x])
      if (c !== null) px[y * cols + x + SPRITE_X] = c
    }
  }
  for (let x = 0; x < cols; x++) {
    const crest = 17 + Math.round(Math.sin((x + tick / 2) * 0.6))
    for (let y = crest; y < CELEBRATE_ROWS * 2; y++) px[y * cols + x] = y === crest ? WAVE_CREST : WAVE_DEEP
  }
  const glyphs = new Map<number, [number, number]>()
  SPARKLES.forEach(([cx, cy], i) => {
    const phase = (Math.floor(tick / 3) + i) % SPARKLE_CHARS.length
    glyphs.set(cy * cols + cx, [SPARKLE_CHARS[phase] ?? 0x20, SPARKLE_COLORS[i % 2] ?? DEFAULT])
  })
  return toCells(cols, CELEBRATE_ROWS, px, glyphs)
}

const cellsOf = (m: Mood, color: (typeof STAGES)[number]['color'], tick: number) =>
  m === 'done'
    ? { cells: celebrate(color, tick), columns: CELEBRATE_COLS, rows: CELEBRATE_ROWS }
    : { cells: encode(frameOf(m, color, tick)), columns: WIDTH, rows: ROWS }

// 口渴動畫播到攤平那格就停住
export const frameOf = (m: Mood, color: (typeof STAGES)[number]['color'], tick: number) => {
  const frames = SPRITES[color][ANIM[m]]
  return frames[m === 'thirsty' ? Math.min(tick, 6) : tick % frames.length] ?? ''
}

const bar = (ratio: number, width: number) => {
  const full = Math.round(Math.min(1, ratio) * width)
  return '▰'.repeat(full) + '▱'.repeat(width - full)
}

type Config = {
  goalMl: number
  servingMl: number
  unit: string
  remindMs: number
  thirstyMs: number
  goalServings: number
}

// 模組變數：熱載入時 register 會重跑並歸零
let startedAt = 0
let nudgedAt = 0
let cheerUntil = 0
let demoUntil = 0
const DEMO_MS = 10 * 1000
// 動畫目前畫在哪、畫什麼；render 時同步，計時器拿來 blit
let band: { requestId: string; mood: Mood; color: (typeof STAGES)[number]['color'] } | undefined
let tick = 0

const servingsOf = (cfg: Config, ml: number) => Math.round((ml / cfg.servingMl) * 10) / 10
const progress = (cfg: Config, day: Day) =>
  `💧 ${servingsOf(cfg, day.totalMl)}/${cfg.goalServings} ${cfg.unit} (${day.totalMl}/${cfg.goalMl}ml)`

async function loadDay($: EngineInterface, key: string): Promise<Day> {
  return ((await $.store.get(key)) as Day | undefined) ?? { totalMl: 0, log: [] }
}

// 每分鐘：換日、心情、提醒
async function refresh($: EngineInterface, cfg: Config) {
  const now = await $.clock.now()
  const day = await loadDay($, dayKey(now))
  await update($, today, () => day)
  $.ui.status(progress(cfg, day))

  const lastAt = day.log.at(-1)?.at
  const next: Mood =
    now < demoUntil || (now >= cheerUntil && day.totalMl >= cfg.goalMl)
      ? 'done'
      : now < cheerUntil
        ? 'cheer'
        : moodAt(now, lastAt, startedAt, cfg.thirstyMs)
  if ((await read($, mood)) !== next) await update($, mood, () => next)

  const quietSince = Math.max(lastAt ?? startedAt, nudgedAt)
  if (cfg.remindMs > 0 && day.totalMl < cfg.goalMl && now - quietSince >= cfg.remindMs) {
    nudgedAt = now
    $.ui.toast(`精靈渴了，喝一${cfg.unit}水吧　${progress(cfg, day)}`)
  }
}

async function animate($: EngineInterface) {
  if (!band) return
  tick += 1
  const shown = band
  const result = await $.ui.blit({
    requestId: shown.requestId,
    key: 'elf',
    ...cellsOf(shown.mood, shown.color, tick),
  })
  // 橫幅收起來了就停，下次 render 再接上
  if ('deny' in result && band === shown) band = undefined
}

export const register: Register = (on, options) => {
  const goalMl = Number(options.dailyGoalMl) || 2000
  const servingMl = Number(options.servingMl) || 250
  const remindMs = Math.max(0, Number(options.remindMinutes) || 0) * MINUTE
  const cfg: Config = {
    goalMl,
    servingMl,
    unit: String(options.servingUnit || '杯'),
    remindMs,
    thirstyMs: remindMs || 3 * 60 * MINUTE,
    goalServings: Math.ceil(goalMl / servingMl),
  }
  const { unit } = cfg
  band = undefined
  tick = 0
  demoUntil = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'water', description: `喝了一${unit}水就打 /water（可加份數，例如 /water 2）` })
    await $.command.register({ name: 'water-elf', description: '顯示／隱藏右側的喝水精靈；/water-elf demo 預覽今日完成畫面' })

    startedAt = await $.clock.now()
    nudgedAt = startedAt
    const saved = (await $.store.get('stats')) as Stats | undefined
    if (saved) await update($, stats, () => saved)
    await refresh($, cfg)
    // 熱載入時面板還開著就不重開；上次被收起來就尊重
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (!isUp && !(await $.store.get('hidden'))) void $.ui.open({ id: PANE, title: PANE_TITLE, columns: 38 })

    $.clock.every(MINUTE, () => void refresh($, cfg))
    $.clock.every(FRAME_MS, () => void animate($))

    return next(e)
  })

  on('command.run', { command: 'water' }, async ($, e) => {
    const servings = parseServings(e.args)
    if (servings === null) return { text: '用法：/water 或 /water 2（份數，最多 20）' }

    const now = await $.clock.now()
    const key = dayKey(now)
    const day = await loadDay($, key)
    const ml = Math.round(servings * servingMl)
    const updated: Day = { totalMl: day.totalMl + ml, log: [...day.log, { at: now, ml }] }
    await $.store.set(key, updated)

    let evolved = ''
    const reached = day.totalMl < goalMl && updated.totalMl >= goalMl
    if (reached) {
      const before = await read($, stats)
      const after = reachGoal(before, now)
      await $.store.set('stats', after)
      await update($, stats, () => after)
      const stage = stageOf(after.goalDays)
      if (stage !== stageOf(before.goalDays)) evolved = `　✨ 精靈進化成「${stage.name}」了！`
    }

    cheerUntil = now + CHEER_MS
    await refresh($, cfg)
    $.clock.after(CHEER_MS + 100, () => void refresh($, cfg))

    const done = reached ? '　🎉 今日目標達成！' : ''
    return { text: `已記 ${servings} ${unit}水 (+${ml}ml)　${progress(cfg, updated)}${done}${evolved}` }
  })

  on('command.run', { command: 'water-elf' }, async ($, e) => {
    // demo：播 10 秒慶祝畫面，不寫入任何紀錄
    if (e.args.trim() === 'demo') {
      const pane = (await $.ui.panes()).find(one => one.id === PANE)
      if (!pane?.isPlaced) {
        if (pane) await $.ui.close({ id: PANE })
        const opened = await $.ui.open({ id: PANE, title: PANE_TITLE, columns: 38 })
        if (!opened.isPlaced) return { text: `精靈面板開不出來：${opened.reason}` }
      }
      demoUntil = (await $.clock.now()) + DEMO_MS
      await refresh($, cfg)
      $.clock.after(DEMO_MS + 100, () => void refresh($, cfg))
      return { text: '播放 10 秒今日完成預覽 ✨（不會記錄）' }
    }

    // 開了但還沒擺上畫面（例如寬度不夠在等）的也算沒顯示，要重開而不是關掉
    const pane = (await $.ui.panes()).find(one => one.id === PANE)
    const hidden = pane?.isPlaced === true
    await $.store.set('hidden', hidden)
    if (hidden) {
      await $.ui.close({ id: PANE })
      return { text: '精靈去休息了，再打 /water-elf 叫它回來' }
    }
    if (pane) await $.ui.close({ id: PANE })
    const opened = await $.ui.open({ id: PANE, title: PANE_TITLE, columns: 38 })
    return { text: opened.isPlaced ? '精靈回來了 💧' : `精靈面板開不出來：${opened.reason}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {

    const [day, st, m] = [await read($, today), await read($, stats), await read($, mood)]
    const now = await $.clock.now()
    const stage = stageOf(st.goalDays)
    const nextStage = STAGES.find(s => s.days > st.goalDays)
    const ratio = day.totalMl / goalMl

    const { Box, Text } = $.ui.resolve(e)
    const isDemo = now < demoUntil
    const info = (
      <Box flexDirection="column">
        <Text bold>{ratio >= 1 || isDemo ? `★ 今日完成 ★${isDemo ? '（預覽）' : ''}` : '☆ 今日進行中'}</Text>
        <Text>{`${bar(ratio, 12)} ${servingsOf(cfg, day.totalMl)}/${cfg.goalServings} ${unit}`}</Text>
        <Text>{`💧 ${day.totalMl} / ${goalMl}ml`}</Text>
        <Text>{`連續 ${liveStreak(st, now)} 天達標`}</Text>
        <Text dimColor>{`${stage.name} · 累計達標 ${st.goalDays} 天`}</Text>
        <Text dimColor>{LINES[m]}</Text>
        {nextStage && (
          <Text dimColor>{`再達標 ${nextStage.days - st.goalDays} 天進化成「${nextStage.name}」`}</Text>
        )}
      </Box>
    )

    // 只有終端機有 Raster；其他介面或高度不夠就只顯示文字
    if (e.surface !== 'terminal') {
      band = undefined
      return <Box paddingX={2}>{info}</Box>
    }

    const { Raster } = $.ui.resolve(e)
    if (band?.mood !== m) tick = 0
    band = { requestId: e.requestId, mood: m, color: stage.color }

    return (
      <Box flexDirection="column" gap={1} paddingX={2}>
        <Raster key="elf" {...cellsOf(m, stage.color, tick)} />
        {info}
      </Box>
    )
  })
}
