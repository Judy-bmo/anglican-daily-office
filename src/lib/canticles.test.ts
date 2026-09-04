import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { assignedCanticles } from './canticles'
import { describeDay } from './churchCalendar'
import type { Canticle, CanticleRule } from './types'

const data: { canticles: Canticle[]; table: CanticleRule[] } =
  JSON.parse(readFileSync('public/data/canticles.json', 'utf8'))

describe('성무일과 송가 (기도서 180~189쪽)', () => {
  it('열세 편이 모두 실려 있다', () => {
    expect(data.canticles).toHaveLength(13)
    for (const c of data.canticles) {
      expect(c.verses.length, c.name).toBeGreaterThan(4)
      expect(c.verses.every((v) => v.text.length > 0), c.name).toBe(true)
    }
    // 배정표가 가리키는 이름은 모두 본문에 있어야 한다
    const names = new Set(data.canticles.map((c) => c.name))
    for (const r of data.table) {
      for (const n of r.canticles) expect(names.has(n), n).toBe(true)
    }
  })

  it('요일과 절기에 따라 기도서 표대로 배정한다', () => {
    // 2026-08-28은 금요일 · 연중시기
    expect(assignedCanticles(data.table, describeDay('2026-08-28'), 'morning'))
      .toEqual(['이사야 둘째 송가', '어린양송가'])
    // 2026-08-30 주일 · 연중시기
    expect(assignedCanticles(data.table, describeDay('2026-08-30'), 'evening'))
      .toEqual(['성모 마리아송가', '성 시므온송가'])
    // 대림 1주일 (2026-11-29)
    expect(assignedCanticles(data.table, describeDay('2026-11-29'), 'morning'))
      .toEqual(['이사야 셋째 송가', '즈가리야송가'])
    // 부활주일 (2026-04-05) — 한 편만 배정되어 있다
    expect(assignedCanticles(data.table, describeDay('2026-04-05'), 'morning'))
      .toEqual(['모세송가'])
  })

  it('절기 항목이 없으면 그 요일의 통상 항목으로 돌아간다', () => {
    // 표에 화요일 저녁 사순 항목은 없다 → 통상 항목을 쓴다
    const lentTuesday = describeDay('2026-03-03')
    expect(lentTuesday.season).toBe('lent')
    expect(lentTuesday.weekday).toBe(2)
    expect(assignedCanticles(data.table, lentTuesday, 'evening'))
      .toEqual(['이사야 둘째 송가', '성모 마리아송가'])
  })

  it('대축일에는 대축일 항목을 쓴다', () => {
    const day = describeDay('2026-08-28')   // 요일과 무관하게 대축일 항목으로
    expect(assignedCanticles(data.table, day, 'morning', true))
      .toEqual(['즈가리야송가', '당신은 하느님'])
  })

  it('낮기도·밤기도에는 배정하지 않는다', () => {
    const day = describeDay('2026-08-28')
    expect(assignedCanticles(data.table, day, 'noon')).toEqual([])
    expect(assignedCanticles(data.table, day, 'night')).toEqual([])
  })
})
