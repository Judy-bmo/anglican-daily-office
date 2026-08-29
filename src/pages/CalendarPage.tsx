import { useMemo, useRef, useState } from 'react'
import {
  addDays, describeDay, isoDate, liturgicalYearStart, parseIso,
  sundayCycleOf, utc, weekdayCycleOf,
} from '../lib/churchCalendar'
import { resolveLectionary } from '../lib/lectionary'
import { SEASON_COLORS } from '../lib/theme'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
import { monthPrintTitle, printWithTitle } from '../lib/print'
import type { AppData } from '../lib/useApp'
import type { Feast } from '../lib/types'

interface Props {
  date: string
  data: AppData
  onPick: (date: string) => void
}

/** 달력에서 지난 날·앞날의 교회력과 독서를 미리 본다. 날짜를 누르면 그날 화면으로 간다. */
export function CalendarPage({ date, data, onPick }: Props) {
  const [cursor, setCursor] = useState(() => date.slice(0, 7))
  const [mode, setMode] = useState<'grid' | 'list'>('grid')
  const [year, month] = cursor.split('-').map(Number)

  const days = useMemo(() => {
    const first = utc(year, month, 1)
    const last = new Date(Date.UTC(year, month, 0))
    const out: Array<{ iso: string; day: ReturnType<typeof describeDay> }> = []
    for (let d = first; d <= last; d = addDays(d, 1)) out.push({ iso: isoDate(d), day: describeDay(d) })
    return out
  }, [year, month])

  const selected = useMemo(() => describeDay(date), [date])

  /** 날짜 → 그날의 가장 높은 등급 축일 */
  const feastByDay = useMemo(() => {
    const order: Record<Feast['rank'], number> = { principal: 3, major: 2, feast: 1, memorial: 0 }
    const m = new Map<number, Feast>()
    for (const f of data.feasts) {
      if (f.month !== month) continue
      for (let d = f.day; d <= (f.dayEnd ?? f.day); d++) {
        const cur = m.get(d)
        if (!cur || order[f.rank] > order[cur.rank]) m.set(d, f)
      }
    }
    return m
  }, [data.feasts, month])

  /** 목록에 적어 줄 이번 달 대축일·주요축일 */
  const monthFeasts = useMemo(
    () => data.feasts
      .filter((f) => f.month === month && (f.rank === 'principal' || f.rank === 'major'))
      .sort((a, b) => a.day - b.day),
    [data.feasts, month],
  )

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  const selectedFeast = useMemo(() => {
    const [, mm, dd] = date.split('-').map(Number)
    return mm === month ? feastByDay.get(dd) : undefined
  }, [date, month, feastByDay])

  const printRef = useRef<HTMLDivElement>(null)

  const lead = parseIso(days[0].iso).getUTCDay()

  // 그 달 한가운데를 기준으로 독서 주기를 적어 둔다
  const cycle = useMemo(() => {
    const y = liturgicalYearStart(parseIso(`${cursor}-15`))
    return { sunday: sundayCycleOf(y), weekday: weekdayCycleOf(y) }
  }, [cursor])

  // 인쇄용 달력: 주 단위로 칸을 채우고, 앞뒤 빈칸은 null로 둔다
  const weeks = useMemo(() => {
    const cells: Array<(typeof days)[number] | null> = [
      ...Array.from({ length: lead }, () => null), ...days,
    ]
    while (cells.length % 7) cells.push(null)
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
  }, [days, lead])

  return (
    <div>
      <div className="no-print">
      <div className="mb-5 flex items-center justify-between">
        <button className="tap px-3" style={{ color: 'var(--ink-muted)' }} onClick={() => shiftMonth(-1)}>←</button>
        <h1 className="text-[1.3em] font-semibold">{year}년 {month}월</h1>
        <button className="tap px-3" style={{ color: 'var(--ink-muted)' }} onClick={() => shiftMonth(1)}>→</button>
      </div>

      {/* 보기 전환은 왼쪽에 묶고 인쇄는 오른쪽에 따로 둔다 — 좁은 화면에서도 한 줄에 들어간다 */}
      <div className="mb-5 flex items-center justify-between gap-2 text-sm">
        <div className="flex gap-2">
          {(['grid', 'list'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className="tap rounded-full px-4 py-1.5"
              style={mode === m
                ? { background: 'var(--accent)', color: 'var(--paper)' }
                : { border: '1px solid var(--rule)', color: 'var(--ink-muted)' }}
            >{m === 'grid' ? '달력' : '독서 목록'}</button>
          ))}
        </div>
        <button
          className="tap shrink-0 rounded-full border px-4 py-1.5"
          style={{ borderColor: 'var(--rule)', color: 'var(--ink-muted)' }}
          aria-label={mode === 'grid'
            ? '이번 달 독서를 달력 모양으로 인쇄'
            : '이번 달 독서를 날짜별 목록으로 인쇄'}
          // 달력 표는 종이를 눕혀야 칸이 살고, 목록은 세로로 똑바로 들어간다
          onClick={() => printWithTitle(
            monthPrintTitle(cursor),
            mode === 'grid' ? { landscape: printRef.current } : {},
          )}
        >인쇄 · PDF</button>
      </div>

      {mode === 'grid' ? (
        <>
          <div className="mb-1 grid grid-cols-7 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
            {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <div key={`pad-${i}`} />)}
            {days.map(({ iso, day }) => {
              const c = SEASON_COLORS[day.color]
              const isSelected = iso === date
              const dd = Number(iso.slice(8))
              const feast = feastByDay.get(dd)
              // 대축일·주요축일은 점을 키우고 날짜를 굵게 해 눈에 띄게 한다
              const big = feast?.rank === 'principal' || feast?.rank === 'major'
              return (
                <button
                  key={iso}
                  onClick={() => onPick(iso)}
                  className="tap-y flex flex-col items-center rounded-xl py-2 text-sm"
                  aria-label={`${iso} ${day.name}${feast ? ` · ${feast.name}` : ''}`}
                  aria-current={isSelected ? 'date' : undefined}
                  style={{
                    background: isSelected ? 'var(--accent-soft)' : 'transparent',
                    outline: isSelected ? '1px solid var(--accent)' : 'none',
                  }}
                >
                  {/* 축일은 붉은 글씨로 적는다. 대축일·주요축일은 더 짙고 굵게. */}
                  <span
                    className="tabular-nums"
                    style={feast
                      ? {
                          color: big ? 'var(--feast-strong)' : 'var(--feast)',
                          fontWeight: big ? 600 : 400,
                        }
                      : undefined}
                  >{dd}</span>
                  <span
                    aria-hidden
                    className="mt-1 rounded-full"
                    style={{
                      background: document.documentElement.dataset.theme === 'dark' ? c.dark : c.light,
                      width: '0.375rem',
                      height: '0.375rem',
                    }}
                  />
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <ul className="space-y-4">
          {days.map(({ iso, day }) => {
            const lect = resolveLectionary(day, data.lectionary)
            return (
              <li key={iso} className="office-section border-b pb-3" style={{ borderColor: 'var(--rule)' }}>
                <button className="text-left" onClick={() => onPick(iso)}>
                  <p className="text-sm">
                    <span className="tabular-nums" style={{ color: 'var(--ink-faint)' }}>{Number(iso.slice(8))}일</span>
                    <span className="ml-2">{day.name}</span>
                  </p>
                </button>
                {lect && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
                    시편 {lect.morningPsalms.map((p) => p.number).join(', ')}
                    <span style={{ color: 'var(--ink-faint)' }}> ✛ </span>
                    {lect.eveningPsalms.map((p) => p.number).join(', ')}
                    {' · '}
                    {[lect.readings.ot, lect.readings.epistle, lect.readings.gospel].filter(Boolean).join(' / ')}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-sm" style={{ color: 'var(--ink-muted)' }}>
        고른 날: {date} · {selected.name}
        {selectedFeast && (
          <span style={{ color: 'var(--feast-strong)' }}> · {selectedFeast.name}</span>
        )}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-faint)' }}>
        날짜를 누르면 그날 성무일과로 갑니다
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-faint)' }}>
        인쇄하면 지금 보고 있는 모양 그대로 나옵니다 —
        달력은 가로로, 독서 목록은 세로로 인쇄됩니다
      </p>

      {mode === 'grid' && (
        <section className="mt-6 border-t pt-4" style={{ borderColor: 'var(--rule)' }}>
          <p className="mb-3 text-xs" style={{ color: 'var(--ink-faint)' }}>
            날짜 아래 점은 그날의 절기색입니다. 축일은 예로부터 붉은 글씨로 적었기에
            같은 방식으로 표시했고, 대축일·주요축일은 더 짙고 굵게 적었습니다.
          </p>
          {monthFeasts.length > 0 && (
            <ul className="space-y-1 text-sm">
              {monthFeasts.map((f) => (
                <li key={`${f.day}-${f.name}`} className="flex gap-3">
                  <span
                    className="shrink-0 tabular-nums"
                    style={{ color: 'var(--feast-strong)', fontWeight: 600, minWidth: '2.4rem' }}
                  >{f.day}일</span>
                  <span>{f.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      </div>

      {/* 인쇄용 — 달력 모양으로 그 달의 독서를 한눈에 */}
      <div className="print-only" ref={printRef}>
        <h1 className="month-title">{year}년 {month}월 성무일과 독서</h1>
        {mode === 'grid' ? (<>
        <p className="month-note">
          칸마다 <b>날짜 · 교회력</b>, <b>시</b> 시편(아침 ✛ 저녁),
          <b> 구</b> 구약 · <b>서</b> 서신 · <b>복</b> 복음 차례입니다.
          축일은 이름 앞에 점을 두었고, 대축일·주요축일은 짙은 색으로 적었습니다.
          평일 독서는 <b>{cycle.sunday}해 / {cycle.weekday}해</b> 기준이며,
          왼쪽 색 띠는 그날의 절기색입니다.
        </p>
        <table className="month-grid">
          <thead>
            <tr>{DOW.map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((cell, ci) => {
                  if (!cell) return <td key={ci} className="empty" />
                  const lect = resolveLectionary(cell.day, data.lectionary)
                  const [, mm, dd] = cell.iso.split('-').map(Number)
                  const feast = data.feasts.find(
                    (f) => f.month === mm && f.day === dd && f.rank !== 'memorial',
                  )
                  const majorFeast = feast?.rank === 'principal' || feast?.rank === 'major'
                  const readings: Array<[string, string | undefined]> = [
                    ['구', lect?.readings.ot],
                    ['서', lect?.readings.epistle],
                    ['복', lect?.readings.gospel],
                  ]
                  return (
                    <td
                      key={ci}
                      className={[cell.day.isSunday && 'sunday', majorFeast && 'major']
                        .filter(Boolean).join(' ') || undefined}
                      style={{ borderLeft: `1.2mm solid ${SEASON_COLORS[cell.day.color].light}` }}
                    >
                      <div className="cell-head">
                        <span className="date">{dd}</span>
                        <span className="season">{cell.day.name}</span>
                      </div>
                      {/* 칸이 좁으므로 축일은 이름만 적는다 (괄호 안 설명은 덜어 낸다) */}
                      {feast && (
                        <div className={`cell-feast cell-feast--${majorFeast ? 'major' : 'minor'}`}>
                          {feast.name.replace(/\s*\(.*$/, '')}
                        </div>
                      )}
                      {lect && (
                        <>
                          <div className="cell-line cell-psalms">
                            <span className="tag">시</span>
                            <span className="ref">
                              {lect.morningPsalms.map((p) => p.number).join(', ')}
                              {' ✛ '}
                              {lect.eveningPsalms.map((p) => p.number).join(', ')}
                            </span>
                          </div>
                          {readings.map(([tag, ref]) => ref && (
                            <div className="cell-line" key={tag}>
                              <span className="tag">{tag}</span>
                              <span className="ref">{ref}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </>) : (<>
        <p className="month-note">
          날짜마다 <b>교회력</b>, <b>시</b> 시편(아침 ✛ 저녁),
          <b> 구</b> 구약 · <b>서</b> 서신 · <b>복</b> 복음 차례입니다.
          축일은 교회력 아래에 적었고, 대축일·주요축일은 짙은 색으로 두었습니다.
          평일 독서는 <b>{cycle.sunday}해 / {cycle.weekday}해</b> 기준이며,
          왼쪽 색 띠는 그날의 절기색입니다.
        </p>
        <table className="month-list">
          <thead>
            <tr>
              <th className="col-date">날짜</th>
              <th className="col-season">교회력</th>
              <th className="col-psalms">시편</th>
              <th>독서</th>
            </tr>
          </thead>
          <tbody>
            {days.map(({ iso, day }) => {
              const lect = resolveLectionary(day, data.lectionary)
              const dd = Number(iso.slice(8))
              const feast = feastByDay.get(dd)
              const majorFeast = feast?.rank === 'principal' || feast?.rank === 'major'
              const readings: Array<[string, string | undefined]> = [
                ['구', lect?.readings.ot],
                ['서', lect?.readings.epistle],
                ['복', lect?.readings.gospel],
              ]
              return (
                <tr
                  key={iso}
                  className={[day.isSunday && 'sunday', majorFeast && 'major']
                    .filter(Boolean).join(' ') || undefined}
                >
                  <td
                    className="col-date"
                    style={{ borderLeft: `1.2mm solid ${SEASON_COLORS[day.color].light}` }}
                  >
                    <span className="date">{dd}</span>
                    <span className="dow">{DOW[parseIso(iso).getUTCDay()]}</span>
                  </td>
                  <td className="col-season">
                    {day.name}
                    {feast && (
                      <span className={`list-feast list-feast--${majorFeast ? 'major' : 'minor'}`}>
                        {feast.name.replace(/\s*\(.*$/, '')}
                      </span>
                    )}
                  </td>
                  <td className="col-psalms">
                    {lect && (
                      <>
                        {lect.morningPsalms.map((ps) => ps.number).join(', ')}
                        <span className="sep">✛</span>
                        {lect.eveningPsalms.map((ps) => ps.number).join(', ')}
                      </>
                    )}
                  </td>
                  <td>
                    {readings.map(([tag, ref]) => ref && (
                      <span className="list-reading" key={tag}>
                        <span className="tag">{tag}</span>{ref}
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </>)}
      </div>
    </div>
  )
}
