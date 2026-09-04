import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveCollect } from './collects'
import { addDays, describeDay, isoDate, parseIso } from './churchCalendar'
import type { CollectDay } from './types'

const collects: CollectDay[] =
  JSON.parse(readFileSync('public/data/collects.json', 'utf8')).collects

describe('오늘의 본기도 (기도서 41~84쪽)', () => {
  it('예순네 날치가 실려 있고 기도문이 비어 있지 않다', () => {
    expect(collects).toHaveLength(64)
    for (const c of collects) {
      expect(c.cycles.length, c.name).toBeGreaterThan(0)
      for (const cy of c.cycles) {
        expect(cy.texts.length, `${c.name} ${cy.cycle}`).toBeGreaterThan(0)
        for (const t of cy.texts) expect(t.length, `${c.name} ${cy.cycle}`).toBeGreaterThan(30)
      }
    }
  })

  it('주일에는 그해 주기의 기도를 드린다', () => {
    // 2026-08-30은 연중 22주일 · 가해
    const sunday = describeDay('2026-08-30')
    expect(sunday.weekday).toBe(0)
    const hit = resolveCollect(collects, sunday)!
    expect(hit.source.name).toBe('연중 22주일')
    expect(hit.cycle).toBe(sunday.sundayCycle)
    expect(hit.texts[0]).toMatch(/하소서|주소서|하옵소서/)
  })

  it('평일에는 그 주간의 기도를 드린다', () => {
    const weekday = describeDay('2026-09-02')      // 연중 22주 수요일
    const hit = resolveCollect(collects, weekday)!
    expect(hit.source.name).toBe('연중 22주일')
    expect(hit.cycle).toBe('주간')
  })

  it('주차로 정해지지 않는 날도 이어 붙는다', () => {
    const cases: Array<[string, string]> = [
      ['2026-04-05', '부활주일'],
      ['2026-05-24', '성령강림주일'],
      ['2026-05-31', '삼위일체주일'],
      ['2026-05-14', '예수 승천일'],
      ['2026-03-29', '사순 6주일 / 고난주일 또는 성지주일'],
      ['2026-04-02', '성목요일 / 성체제정일'],
      ['2026-04-03', '성금요일 / 주의 수난일'],
      ['2026-04-04', '성토요일'],
      ['2026-01-06', '공현일 1월 6일'],
      ['2026-12-25', '성탄 밤'],
    ]
    for (const [iso, expected] of cases) {
      const hit = resolveCollect(collects, describeDay(iso))
      expect(hit?.source.day, iso).toBe(expected)
    }
  })

  it('2024~2030년 모든 날에 본기도가 있다', () => {
    const missing: string[] = []
    let d = parseIso('2024-01-01')
    const end = parseIso('2030-12-31')
    while (d <= end) {
      const iso = isoDate(d)
      if (!resolveCollect(collects, describeDay(iso))) missing.push(iso)
      d = addDays(d, 1)
    }
    expect(missing.slice(0, 12)).toEqual([])
  })
})
