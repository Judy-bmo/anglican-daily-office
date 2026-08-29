import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { adventSunday, describeDay, isoDate, addDays } from './churchCalendar'
import { buildIndex, parsePsalmSpec, resolveLectionary } from './lectionary'
import type { LectionaryDay } from './types'

const days: LectionaryDay[] = JSON.parse(readFileSync('public/data/lectionary.json', 'utf8')).days
const index = buildIndex(days)

describe('시편 지정 표기 해석', () => {
  it('쉼표·절범위·대괄호·또는 표기를 나눈다', () => {
    expect(parsePsalmSpec('146, 147')).toEqual([{ number: 146 }, { number: 147 }])
    expect(parsePsalmSpec('119:105-112')).toEqual([{ number: 119, verses: '105-112' }])
    expect(parsePsalmSpec('50[59, 60]')).toEqual([
      { number: 50 }, { number: 59, optional: true }, { number: 60, optional: true },
    ])
    expect(parsePsalmSpec('113, 114, 또는 118')).toEqual([
      { number: 113 }, { number: 114 }, { number: 118, alternative: true },
    ])
    expect(parsePsalmSpec(null)).toEqual([])
  })
})

describe('성무일과 성서정과 매칭', () => {
  const walk = (startYear: number) => {
    const out: Array<{ date: string; name: string; hit: ReturnType<typeof resolveLectionary> }> = []
    let d = adventSunday(startYear)
    const end = adventSunday(startYear + 1)
    while (d < end) {
      const info = describeDay(d)
      out.push({ date: isoDate(d), name: info.name, hit: resolveLectionary(info, index) })
      d = addDays(d, 1)
    }
    return out
  }

  it('한 교회력 연도의 모든 날에 정과가 매칭된다 (2025/2026)', () => {
    const rows = walk(2025)
    const misses = rows.filter((r) => !r.hit)
    if (misses.length) console.log('매칭 실패:', misses.map((m) => `${m.date} ${m.name}`).join('\n'))
    expect(misses).toHaveLength(0)
    expect(rows.length).toBeGreaterThan(360)
  })

  it('여러 해에 걸쳐도 빠짐이 없다 (2004~2044)', () => {
    const misses: string[] = []
    for (let y = 2004; y <= 2044; y++) {
      for (const r of walk(y)) if (!r.hit) misses.push(`${r.date} ${r.name}`)
    }
    if (misses.length) console.log(`매칭 실패 ${misses.length}건:\n` + misses.slice(0, 30).join('\n'))
    expect(misses).toHaveLength(0)
  })

  it('모든 날에 아침·저녁 시편이 지정된다', () => {
    const bad = walk(2025).filter((r) => !r.hit!.morningPsalms.length || !r.hit!.eveningPsalms.length)
    if (bad.length) console.log('시편 없음:', bad.map((b) => `${b.date} ${b.name} → ${b.hit!.day.label}`).slice(0, 20))
    expect(bad).toHaveLength(0)
  })

  it('평일에는 1해·2해 중 그 해의 독서가 붙는다', () => {
    const weekdays = walk(2025).filter((r) => !r.date.endsWith('X') && r.hit!.day.kind === 'weekday')
    for (const r of weekdays.slice(0, 40)) {
      expect(r.hit!.readings.gospel, `${r.date} ${r.hit!.day.label}`).toBeTruthy()
    }
    // 2025/2026 교회력은 2해
    expect(describeDay('2026-01-20').weekdayCycle).toBe(2)
    expect(resolveLectionary(describeDay('2026-01-20'), index)!.year).toBe('2')
  })

  it('12월 17일 ~ 1월 12일은 요일이 아니라 날짜로 지정된다 (기도서 484쪽)', () => {
    const dec18 = resolveLectionary(describeDay('2025-12-18'), index)!
    expect(dec18.matchedBy).toBe('date')
    expect(dec18.day.label).toBe('12월 18일')
    const jan9 = resolveLectionary(describeDay('2026-01-09'), index)!
    expect(jan9.matchedBy).toBe('date')
    expect(jan9.day.label).toBe('1월 9일')
    // 창 밖은 절기·요일 규칙
    expect(resolveLectionary(describeDay('2025-12-16'), index)!.matchedBy).toBe('season')
  })

  it('특별한 날은 고유 정과를 쓴다', () => {
    expect(resolveLectionary(describeDay('2026-02-18'), index)!.day.label).toBe('재의 수요일')
    expect(resolveLectionary(describeDay('2026-05-24'), index)!.day.label).toBe('성령강림주일')
    expect(resolveLectionary(describeDay('2026-05-14'), index)!.day.label).toBe('승천일')
    expect(resolveLectionary(describeDay('2025-12-25'), index)!.day.label).toBe('성탄일')
  })

  it('부활주일·고난주일은 아침/저녁 독서가 따로 지정된다', () => {
    const easter = resolveLectionary(describeDay('2026-04-05'), index)!
    expect(easter.day.label).toBe('부활주일')
    expect(easter.offices?.morning).toBeTruthy()
    expect(easter.offices?.evening).toBeTruthy()
  })

  it('전일(前日) 정과를 저녁기도용으로 찾아 준다', () => {
    expect(resolveLectionary(describeDay('2025-12-24'), index)!.eve?.label).toBe('성탄전일')
    expect(resolveLectionary(describeDay('2026-01-05'), index)!.eve?.label).toBe('공현일 전일')
    expect(resolveLectionary(describeDay('2026-05-23'), index)!.eve?.label).toBe('강림 전일')
  })
})
