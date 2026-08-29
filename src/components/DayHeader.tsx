import type { ChurchDay } from '../lib/churchCalendar'
import type { Feast } from '../lib/types'

const RANK_LABEL: Record<Feast['rank'], string> = {
  principal: '대축일', major: '주요축일', feast: '축일', memorial: '기념일',
}

export function formatKoreanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y}년 ${m}월 ${d}일 ${weekday}요일`
}

export function DayHeader({ day, feasts }: { day: ChurchDay; feasts: Feast[] }) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: 'var(--accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
          {formatKoreanDate(day.date)}
        </p>
      </div>

      <h1 className="mt-2 text-[1.7em] leading-snug font-semibold">{day.name}</h1>

      <p className="mt-1.5 text-sm" style={{ color: 'var(--ink-muted)' }}>
        {day.seasonName} · {day.colorName}
        {day.alternateColor && <span style={{ color: 'var(--ink-faint)' }}> (장미색 가능)</span>}
        {' · '}{day.sundayCycle}해 / {day.weekdayCycle}해
      </p>

      {feasts.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {feasts.map((f, i) => (
            <li key={i} className="text-sm">
              <span
                className="mr-2 rounded-full px-2 py-0.5 text-[0.75em]"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >{RANK_LABEL[f.rank]}</span>
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
