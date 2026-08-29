import { describe, it, expect } from 'vitest'
import { describeDay, WEEKDAY_NAMES, parseIso, dayOfWeek } from './churchCalendar'
import fixture from './__fixtures__/ics-days.json'

/**
 * 대한성공회가 공개하는 「전례독서」 구글 캘린더(2018~2026)와 대조한다.
 *
 * 이 캘린더는 사람이 손으로 입력한 것이라 오기가 섞여 있다. 그래서
 *  (1) 적힌 요일이 그 날짜의 실제 요일과 다르면 캘린더 쪽 오기로 보고 건너뛰고,
 *  (2) 그날이 이동 대축일이면 엔진이 축일 이름을 쓰므로 이름 차이를 허용하며,
 *  (3) 그 밖에 확인된 차이는 아래 표에 근거를 적어 둔다.
 * 나머지는 100% 일치해야 한다.
 */

/** 기도서 본문과 대조해 엔진이 옳다고 확인한, 캘린더 쪽 차이 */
const KNOWN_CALENDAR_DIFFS: Record<string, string> = {
  '2019-01-31': '연중 3주일(1.21-27)에 1/27 주일이 들므로 그 주간은 연중 3주 — 기도서 501쪽',
  '2019-02-01': '위와 같음',
  '2021-10-26': '왕이신 그리스도주일(11/21)에서 역산하면 연중 30주 — 캘린더의 20주는 오기',
  '2021-10-27': '위와 같음',
  '2023-07-05': '연중 13주일(6.26-7.2)에 7/2 주일이 듦 — 기도서 508쪽',
  '2024-08-16': '연중 19주일(8.7-13)에 8/11 주일이 듦 — 기도서 512쪽',
  '2024-08-17': '위와 같음',
  '2026-06-12': '연중 10주일(6.5-11)에 6/7 주일이 듦 — 기도서 506쪽',
  '2026-02-19': '재의 수요일 다음 목·금·토는 사순절에 들며, 기도서 490쪽도 재의 수요일 묶음에 둔다',
  '2026-02-20': '위와 같음',
  '2026-04-07': '캘린더 자체가 어긋난다 — 같은 주간의 4/8~4/11은 「부활 1주」로 적혀 있다',
}

const WEEKDAY_IN_NAME = /(주일|월요일|화요일|수요일|목요일|금요일|토요일)$/

describe('교회력 엔진 ↔ 대한성공회 공식 캘린더 대조', () => {
  const rows = fixture as Array<{ date: string; names: string[] }>

  it('사람이 적은 요일이 실제 요일과 다른 날은 캘린더 쪽 오기다', () => {
    const wrong = rows.filter((r) =>
      r.names.every((n) => {
        const m = n.match(WEEKDAY_IN_NAME)
        if (!m) return false
        const stated = m[1] === '주일' ? 0 : WEEKDAY_NAMES.indexOf(m[1] as (typeof WEEKDAY_NAMES)[number])
        return stated !== dayOfWeek(parseIso(r.date))
      }),
    )
    // 이런 날이 있다는 사실 자체를 기록해 둔다(2026년 8월 기준 3건)
    expect(wrong.length).toBeLessThan(10)
  })

  it('그 밖의 날은 절기·주차·요일 이름이 모두 일치한다', () => {
    const mismatches: string[] = []
    let compared = 0
    for (const row of rows) {
      const day = describeDay(row.date)
      // (1) 캘린더가 요일을 잘못 적은 날은 제외
      const statedWeekdayWrong = row.names.every((n) => {
        const m = n.match(WEEKDAY_IN_NAME)
        if (!m) return false
        const stated = m[1] === '주일' ? 0 : WEEKDAY_NAMES.indexOf(m[1] as (typeof WEEKDAY_NAMES)[number])
        return stated !== day.weekday
      })
      if (statedWeekdayWrong) continue
      // (2) 이동 대축일은 엔진이 축일 이름을 쓴다
      if (day.principalFeast) continue
      // (3) 근거를 적어 둔 알려진 차이
      if (KNOWN_CALENDAR_DIFFS[row.date]) continue

      compared++
      const got = day.name.replace(/\s+/g, '').replace(/\(.*\)$/, '')
      const ok = row.names.some((n) => n === got || got.startsWith(n) || n.startsWith(got))
      if (!ok) mismatches.push(`${row.date}  캘린더=${row.names.join('|')}  엔진=${got}`)
    }
    if (mismatches.length) console.log(`\n불일치 ${mismatches.length}/${compared}\n` + mismatches.join('\n'))
    expect(compared).toBeGreaterThan(2000)
    expect(mismatches).toEqual([])
  })
})
