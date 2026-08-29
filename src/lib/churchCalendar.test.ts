import { describe, it, expect } from 'vitest'
import {
  adventSunday, ascensionDay, ashWednesday, baptismOfTheLord, christTheKing,
  describeDay, easterSunday, isoDate, pentecost, sundayCycleOf, trinitySunday,
  utc, weekdayCycleOf, diffDays, dayOfWeek,
} from './churchCalendar'
import cycles from './__fixtures__/year-cycles.json'

describe('부활주일 계산 (Computus)', () => {
  // 널리 검증된 그레고리력 부활주일 날짜
  const known: Record<number, string> = {
    2000: '2000-04-23', 2004: '2004-04-11', 2005: '2005-03-27', 2008: '2008-03-23',
    2011: '2011-04-24', 2016: '2016-03-27', 2018: '2018-04-01', 2019: '2019-04-21',
    2020: '2020-04-12', 2021: '2021-04-04', 2022: '2022-04-17', 2023: '2023-04-09',
    2024: '2024-03-31', 2025: '2025-04-20', 2026: '2026-04-05', 2027: '2027-03-28',
    2028: '2028-04-16', 2029: '2029-04-01', 2030: '2030-04-21', 2031: '2031-04-13',
    2032: '2032-03-28', 2033: '2033-04-17', 2034: '2034-04-09', 2035: '2035-03-25',
    2038: '2038-04-25', 2040: '2040-04-01', 2044: '2044-04-17',
  }
  it('알려진 날짜와 일치한다', () => {
    for (const [y, d] of Object.entries(known)) {
      expect(isoDate(easterSunday(Number(y))), `${y}년`).toBe(d)
    }
  })

  it('기도서 26쪽대로 언제나 3월 22일 ~ 4월 25일 사이에 온다', () => {
    for (let y = 1900; y <= 2200; y++) {
      const e = easterSunday(y)
      expect(dayOfWeek(e), `${y}년은 주일이어야 한다`).toBe(0)
      expect(e >= utc(y, 3, 22) && e <= utc(y, 4, 25), `${y}년 ${isoDate(e)}`).toBe(true)
    }
  })
})

describe('대림 1주일', () => {
  it('성탄일 전 네 번째 주일이다', () => {
    for (let y = 2000; y <= 2100; y++) {
      const a = adventSunday(y)
      expect(dayOfWeek(a)).toBe(0)
      // 성탄일 전 네 번째 주일 = 11/27 ~ 12/3 사이
      expect(a >= utc(y, 11, 27) && a <= utc(y, 12, 3), `${y}년 ${isoDate(a)}`).toBe(true)
    }
  })

  it('성 안드레축일(11월 30일)에 가장 가까운 주일과 같다', () => {
    for (let y = 2000; y <= 2100; y++) {
      const andrew = utc(y, 11, 30)
      const nearest = [-3, -2, -1, 0, 1, 2, 3]
        .map((n) => new Date(andrew.getTime() + n * 86400000))
        .find((d) => dayOfWeek(d) === 0)!
      expect(isoDate(adventSunday(y)), `${y}년`).toBe(isoDate(nearest))
    }
  })

  it('알려진 해의 대림 1주일', () => {
    expect(isoDate(adventSunday(2025))).toBe('2025-11-30')
    expect(isoDate(adventSunday(2026))).toBe('2026-11-29')
    expect(isoDate(adventSunday(2004))).toBe('2004-11-28')
  })
})

describe('독서 주기 — 기도서 436쪽 「성서정과표 년도구분」 대조표', () => {
  it('2004~2042년 대조표와 완전히 일치한다', () => {
    for (const row of cycles as Array<{ startYear: number; sundayCycle: string; weekdayCycle: number }>) {
      expect(sundayCycleOf(row.startYear), `${row.startYear}/${row.startYear + 1} 주일구분`)
        .toBe(row.sundayCycle)
      expect(weekdayCycleOf(row.startYear), `${row.startYear}/${row.startYear + 1} 주간구분`)
        .toBe(row.weekdayCycle)
    }
    expect((cycles as unknown[]).length).toBeGreaterThanOrEqual(39)
  })

  it('기도서 484쪽 규칙 — 대림 1주일 시작 연도가 짝수면 1해', () => {
    expect(weekdayCycleOf(2004)).toBe(1)
    expect(weekdayCycleOf(2005)).toBe(2)
  })
})

describe('이동축일 사이의 관계', () => {
  it('기도서 26~27쪽 규정대로 맞물린다', () => {
    for (let y = 2004; y <= 2050; y++) {
      const easter = easterSunday(y)
      expect(diffDays(easter, ashWednesday(y))).toBe(46)
      expect(diffDays(ascensionDay(y), easter)).toBe(39)
      expect(dayOfWeek(ascensionDay(y)), '승천일은 목요일').toBe(4)
      expect(diffDays(pentecost(y), easter)).toBe(49)
      expect(diffDays(trinitySunday(y), pentecost(y))).toBe(7)
      expect(diffDays(adventSunday(y), christTheKing(y))).toBe(7)
      // 주의 세례주일은 공현일 다음 첫 주일이므로 1/7~1/13에 든다
      const b = baptismOfTheLord(y)
      expect(b >= utc(y, 1, 7) && b <= utc(y, 1, 13)).toBe(true)
    }
  })
})

describe('절기 판정', () => {
  it('연중 34주일은 언제나 왕이신 그리스도주일이다', () => {
    for (let y = 2005; y <= 2050; y++) {
      const d = describeDay(christTheKing(y))
      expect(d.season, `${y}년`).toBe('ordinary')
      expect(d.week, `${y}년`).toBe(34)
      expect(d.color).toBe('white')
    }
  })

  it('연중 1주일은 주의 세례주일이다', () => {
    for (let y = 2005; y <= 2050; y++) {
      const d = describeDay(baptismOfTheLord(y))
      expect(d.season, `${y}년`).toBe('ordinary')
      expect(d.week, `${y}년`).toBe(1)
    }
  })

  it('교회력 첫날은 대림 1주일이다', () => {
    const d = describeDay('2025-11-30')
    expect(d.name).toBe('대림 1주일')
    expect(d.season).toBe('advent')
    expect(d.color).toBe('violet')
    expect(d.liturgicalYearStart).toBe(2025)
    expect(d.sundayCycle).toBe('가')
    expect(d.weekdayCycle).toBe(2)
  })

  it('절기색이 기도서 30~31쪽 규정을 따른다', () => {
    expect(describeDay('2026-04-05').color).toBe('white')   // 부활주일
    expect(describeDay('2026-05-24').color).toBe('red')     // 성령강림주일
    expect(describeDay('2026-02-18').color).toBe('violet')  // 재의 수요일
    expect(describeDay('2026-08-29').color).toBe('green')   // 연중 평일
    expect(describeDay('2026-03-29').color).toBe('red')     // 고난주일(성주간)
    expect(describeDay('2025-12-14').alternateColor).toBe('rose') // 대림 3주일
  })

  it('예시 날짜 — 2026년 8월 29일', () => {
    const d = describeDay('2026-08-29')
    expect(d.name).toBe('연중 21주 토요일')
    expect(d.week).toBe(21)
    expect(d.sundayCycle).toBe('가')
    expect(d.weekdayCycle).toBe(2)
  })

  it('한 교회력 연도의 모든 날에 이름이 붙는다', () => {
    let d = adventSunday(2025)
    const end = adventSunday(2026)
    while (d < end) {
      const info = describeDay(d)
      expect(info.name, info.date).toBeTruthy()
      expect(info.name, info.date).not.toContain('undefined')
      d = new Date(d.getTime() + 86400000)
    }
  })
})
