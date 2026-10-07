import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CELEBRATE_COLS, CELEBRATE_ROWS, celebrate, dayKey, encode, frameOf, moodAt, parseServings, reachGoal, stageOf } from './register'

const MIN = 60 * 1000
const NOW = new Date(2026, 9, 6, 9, 0).getTime()

test('份數解析', () => {
  expect(parseServings('')).toBe(1)
  expect(parseServings(' 2 ')).toBe(2)
  expect(parseServings('0.5')).toBe(0.5)
  expect(parseServings('abc')).toBe(null)
  expect(parseServings('0')).toBe(null)
  expect(parseServings('99')).toBe(null)
})

test('本機日期 key', () => {
  expect(dayKey(NOW)).toBe('day:2026-10-06')
})

test('心情：剛喝開心、久沒喝口渴、今天沒喝從啟動算', () => {
  expect(moodAt(NOW, NOW - 10 * MIN, NOW - 999 * MIN, 90 * MIN)).toBe('happy')
  expect(moodAt(NOW, NOW - 60 * MIN, NOW - 999 * MIN, 90 * MIN)).toBe('idle')
  expect(moodAt(NOW, NOW - 90 * MIN, NOW - 999 * MIN, 90 * MIN)).toBe('thirsty')
  expect(moodAt(NOW, undefined, NOW - 5 * MIN, 90 * MIN)).toBe('idle')
})

test('連續達標與進化', () => {
  const yesterday = { goalDays: 2, streak: 2, lastGoalDay: dayKey(NOW - 24 * 60 * MIN) }
  expect(reachGoal(yesterday, NOW)).toEqual({ goalDays: 3, streak: 3, lastGoalDay: 'day:2026-10-06' })
  expect(reachGoal({ ...yesterday, lastGoalDay: 'day:2026-01-01' }, NOW).streak).toBe(1)
  expect(stageOf(0).name).toBe('青苔寶寶')
  expect(stageOf(3).name).toBe('水精靈')
  expect(stageOf(30).name).toBe('晨光精靈')
  expect(stageOf(60).name).toBe('珊瑚精靈')
})

test('像素格編碼：14x8 格，每格 12 bytes', () => {
  const cells = encode(frameOf('idle', 'blue', 0))
  expect(cells.length).toBe(Math.ceil((14 * 8 * 12) / 3) * 4)
  // 口渴動畫 0～6 播完，攤平那格多停 3 格（150ms × 3）再從頭播
  expect(frameOf('thirsty', 'blue', 9)).toBe(frameOf('thirsty', 'blue', 6))
  expect(frameOf('thirsty', 'blue', 10)).toBe(frameOf('thirsty', 'blue', 0))
  expect(frameOf('thirsty', 'blue', 16)).toBe(frameOf('thirsty', 'blue', 6))
  expect(celebrate('blue', 0).length).toBe(Math.ceil((CELEBRATE_COLS * CELEBRATE_ROWS * 12) / 3) * 4)
})

test('達標後面板換成今日完成慶祝畫面', { options: { dailyGoalMl: 500, servingMl: 500 } }, async ($, on) => {
  const { clock } = engine(on)
  await start($)
  await water($)
  // 喝完先跳 3 秒，之後進入慶祝
  await clock.advance(3200)
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await mountBand($, surface)
    expect(await pane.find({ text: '★ 今日完成 ★' })).toBeDefined()
    expect(await pane.find({ text: '連續 1 天達標' })).toBeDefined()
  }
  // 星星每 3 格換一次字，跑一輪確認每種字元都能被終端機接受
  await clock.advance(12 * 150)
})

const engine = (on: On) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.blit', () => ({ value: {} }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  return { clock, toasts }
}

const start = ($: Engine) => $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
const mountBand = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({
    plugin: 'water-elf',
    surface,
    component: 'Pane',
    requestId: 'water-elf',
    props: { title: '💧 喝水精靈', isFocused: false, bodyColumns: 34, placement: 'dock' } as never,
  })
const water = ($: Engine, args = '', command = 'water') =>
  $.command.run({
    command,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

test('喝到目標：累計達標 +1，訊息有進度', { options: { dailyGoalMl: 1000, servingMl: 500, servingUnit: '瓶' } }, async ($, on) => {
  engine(on)
  await start($)
  const first = await water($)
  expect(first.text).toContain('已記 1 瓶水 (+500ml)')
  const second = await water($)
  expect(second.text).toContain('2/2 瓶 (1000/1000ml)')
  expect(second.text).toContain('今日目標達成')
  const band = await mountBand($, 'terminal')
  expect(await band.find({ text: '連續 1 天達標' })).toBeDefined()
  expect((await water($, 'abc')).text).toContain('用法')
})

test('超過提醒間隔沒喝會跳提醒', { options: { remindMinutes: 30 } }, async ($, on) => {
  const { clock, toasts } = engine(on)
  await start($)
  // 動畫每 150ms 一次，分段快轉免得一次觸發太多計時器
  const minutes = async (n: number) => {
    for (let i = 0; i < n; i++) await clock.advance(MIN)
  }
  await minutes(29)
  expect(toasts.length).toBe(0)
  await minutes(2)
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('精靈渴了')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`右側面板在 ${surface} 畫得出來`, async ($, on) => {
    engine(on)
    await start($)
    await water($)
    const band = await mountBand($, surface)
    expect(await band.find({ text: '☆ 今日進行中' })).toBeDefined()
    expect(await band.find({ text: '青苔寶寶 · 累計達標 0 天' })).toBeDefined()
    expect(await band.find({ text: '咕嘟咕嘟～好喝！' })).toBeDefined()
  })
}

test('demo 播 10 秒今日完成預覽，不寫入紀錄', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  expect((await water($, 'demo', 'water-elf')).text).toContain('預覽')
  const pane = await mountBand($, 'terminal')
  expect(await pane.find({ text: '★ 今日完成 ★（預覽）' })).toBeDefined()
  expect(await pane.find({ text: '💧 0 / 2000ml' })).toBeDefined()
  // 同一個面板會隨狀態重畫，不用重新 mount
  await clock.advance(10_200)
  expect(await pane.find({ text: '☆ 今日進行中' })).toBeDefined()
  expect(await pane.find({ text: '青苔寶寶 · 累計達標 0 天' })).toBeDefined()
})

test('demo 可指定心情，亂打會提示用法', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  expect((await water($, 'demo nope', 'water-elf')).text).toContain('用法')
  expect((await water($, 'demo thirsty', 'water-elf')).text).toContain('thirsty')
  const pane = await mountBand($, 'terminal')
  expect(await pane.find({ text: '☆ 今日進行中（預覽）' })).toBeDefined()
  expect(await pane.find({ text: '好渴…快融化了…' })).toBeDefined()
  await clock.advance(10_200)
  expect(await pane.find({ text: '在旁邊陪你寫 code' })).toBeDefined()
})
