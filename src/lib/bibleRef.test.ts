import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { parseReference, verseLabels } from './bibleRef'
import type { BibleBook, LectionaryDay } from './types'

const books: BibleBook[] = JSON.parse(readFileSync('public/data/bible-books.json', 'utf8'))
const ALIASES: Record<string, string> = {
  사무상: '1사무', 사무하: '2사무', 열왕상: '1열왕', 열왕하: '2열왕',
  역대상: '1역대', 역대하: '2역대', 마카상: '1마카', 마카하: '2마카',
}
const index = new Map<string, BibleBook>()
for (const b of books) { index.set(b.short_name_ko, b); index.set(b.name_ko, b) }
for (const [from, to] of Object.entries(ALIASES)) {
  const b = index.get(to); if (b) index.set(from, b)
}

const days: LectionaryDay[] = JSON.parse(readFileSync('public/data/lectionary.json', 'utf8')).days
function allRefs(): string[] {
  const out: string[] = []
  for (const d of days) {
    for (const set of Object.values(d.readings)) {
      for (const [k, v] of Object.entries(set)) {
        if (k === 'extra') { out.push(...(v as string[])); continue }
        if (typeof v === 'string') out.push(v)
      }
    }
    for (const o of Object.values(d.offices ?? {})) out.push(...o.readings)
  }
  return out
}

describe('성서 인용 표기 해석', () => {
  it('기본형과 변형을 모두 다룬다', () => {
    const p = (s: string) => parseReference(s, index)
    expect(p('이사 1:1-9')).toMatchObject({
      bookId: 'isa', ranges: [{ startCh: 1, startV: 1, endCh: 1, endV: 9 }],
    })
    expect(p('창세 1:1-2:4').ranges).toEqual([{ startCh: 1, startV: 1, endCh: 2, endV: 4, optional: false }])
    expect(p('2베드 3:1-10').bookId).toBe('2pet')
    expect(p('사무상 16:1-13').bookId).toBe('1sam')
    expect(p('마카상 1:1-5').bookId).toBe('1macc')
    // 원문 오탈자('히브: 4:1-10')도 견딘다
    expect(p('히브: 4:1-10')).toMatchObject({ bookId: 'heb', ranges: [{ startCh: 4, startV: 1, endV: 10 }] })
    // 쉼표로 이어지는 여러 구간
    expect(p('아모 1:1-5, 13-2:8').ranges).toHaveLength(2)
    // 괄호는 '선택해서 읽는 부분'
    expect(p('이사 42:(1-9)10-17').ranges.some((r) => r.optional)).toBe(true)
    // 장 전체
    expect(p('시편 23').ranges).toEqual([{ startCh: 23, endCh: 23, optional: false }])
    // '4하'처럼 절의 뒷부분을 가리키는 표기
    expect(p('필립 3:4하-11').ranges[0]).toMatchObject({ startCh: 3, startV: 4, endV: 11 })
  })

  it('성서정과에 실린 모든 인용에서 성서 권을 찾아낸다', () => {
    const refs = allRefs()
    expect(refs.length).toBeGreaterThan(2000)
    const failed = refs.filter((r) => !parseReference(r, index).bookId)
    if (failed.length) console.log('권을 못 찾은 인용:', [...new Set(failed)].slice(0, 30))
    expect(failed).toEqual([])
  })

  it('모든 인용이 최소 한 구간으로 해석되고 장 범위를 벗어나지 않는다', () => {
    const bad: string[] = []
    for (const raw of allRefs()) {
      const ref = parseReference(raw, index)
      const book = index.get(ref.bookName)!
      if (!ref.ranges.length) { bad.push(`구간 없음: ${raw}`); continue }
      for (const r of ref.ranges) {
        if (r.startCh < 1 || r.endCh > book.chapter_count || r.endCh < r.startCh) {
          bad.push(`장 범위 벗어남: ${raw} → ${r.startCh}~${r.endCh} (${book.short_name_ko} ${book.chapter_count}장)`)
        }
      }
    }
    if (bad.length) console.log([...new Set(bad)].slice(0, 30).join('\n'))
    expect(bad).toEqual([])
  })

  it('인용에 해당하는 본문 파일이 실제로 존재한다', () => {
    const missing = new Set<string>()
    for (const raw of allRefs()) {
      const ref = parseReference(raw, index)
      for (const r of ref.ranges) {
        for (let ch = r.startCh; ch <= r.endCh; ch++) {
          const f = `public/data/bible/${ref.bookId}-${ch}.json`
          if (!existsSync(f)) missing.add(`${raw} → ${f}`)
        }
      }
    }
    if (missing.size) console.log([...missing].slice(0, 20).join('\n'))
    expect([...missing]).toEqual([])
  })
})

describe('절 번호 표시', () => {
  const v = (chapter: number, number: number) => ({ chapter, number, text: '' })

  it('장이 바뀌는 자리에는 장도 함께 적는다', () => {
    // 욥기 9:1, 10:1-9, 16-22 — 9장 1절과 10장 1절이 헷갈리지 않아야 한다
    expect(verseLabels([v(9, 1), v(10, 1), v(10, 2), v(10, 3)]))
      .toEqual(['9:1', '10:1', '2', '3'])
  })

  it('한 장 안에서는 절 번호만 쓴다', () => {
    expect(verseLabels([v(16, 15), v(16, 16), v(16, 17)]))
      .toEqual(['16:15', '16', '17'])
  })

  it('장을 넘나들어도 바뀔 때마다 다시 적는다', () => {
    expect(verseLabels([v(1, 1), v(1, 2), v(2, 1), v(2, 2), v(3, 1)]))
      .toEqual(['1:1', '2', '2:1', '2', '3:1'])
  })
})
