/**
 * 기도서 성서정과의 인용 표기를 해석하고, 「공동번역성서 개정판」 본문을 가져온다.
 *
 * 표기 예: '이사 1:1-9', '창세 1:1-2:4', '아모 1:1-5, 13-2:8',
 *          '이사 42:(1-9)10-17', '1고린 10:14-17, 11:27-32', '시편 23'
 */
import { loadBibleBooks, loadChapter } from './data'
import { correctReference, shiftNumbering } from './errata'
import type { BibleBook, BibleVerse } from './types'

/** 기도서 약어가 성서 웹 데이터의 약어와 다른 경우 */
const ALIASES: Record<string, string> = {
  사무상: '1사무', 사무하: '2사무',
  열왕상: '1열왕', 열왕하: '2열왕',
  역대상: '1역대', 역대하: '2역대',
  마카상: '1마카', 마카하: '2마카',
}

export interface VerseRange {
  startCh: number
  startV?: number
  endCh: number
  endV?: number
  /** 괄호로 묶여 선택적으로 읽는 구간 */
  optional?: boolean
}

export interface BibleRef {
  raw: string
  bookName: string
  bookId: string | null
  ranges: VerseRange[]
}

let bookIndex: Map<string, BibleBook> | null = null

export async function bibleBookIndex(): Promise<Map<string, BibleBook>> {
  if (!bookIndex) {
    const books = await loadBibleBooks()
    const m = new Map<string, BibleBook>()
    for (const b of books) {
      m.set(b.short_name_ko, b)
      m.set(b.name_ko, b)
    }
    for (const [from, to] of Object.entries(ALIASES)) {
      const b = m.get(to)
      if (b) m.set(from, b)
    }
    bookIndex = m
  }
  return bookIndex
}

/** '히브: 4:1-10', '이;사 28:9-16'처럼 원문에 남은 잔글자를 정리한다. */
function tidy(raw: string): string {
  return raw.replace(/([가-힣])[;:](?=\s|[가-힣])/g, '$1').replace(/\s+/g, ' ').trim()
}

export function parseReference(raw: string, index: Map<string, BibleBook>): BibleRef {
  const text = tidy(correctReference(raw)?.corrected ?? raw)
  const m = text.match(/^([1-3]?\s*[가-힣]{2,4})\s*(.*)$/)
  const ref: BibleRef = { raw, bookName: '', bookId: null, ranges: [] }
  if (!m) return ref

  const name = m[1].replace(/\s+/g, '')
  ref.bookName = name
  ref.bookId = index.get(name)?.id ?? null

  // 필레몬서·요한2·3서처럼 한 장뿐인 책은 '1-8'이 장이 아니라 절을 뜻한다
  let chapter = (index.get(name)?.chapter_count ?? 0) === 1 ? 1 : 0
  let optional = false

  // 괄호는 '선택해서 읽는 부분'이며 인용 한가운데에도 온다: '묵시 7:(4-8)9-17'
  const TOKEN = /(\d+)\s*:\s*(?=[(\d])|(\d+)\s*[-\u2013]\s*(\d+)\s*:\s*(\d+)|(\d+)\s*[-\u2013]\s*(\d+)|(\d+)|[()]/g
  const tail = m[2].replace(/([0-9])[\uc0c1\ud558]/g, '$1')
  let t: RegExpExecArray | null
  while ((t = TOKEN.exec(tail))) {
    const [tok, chapterMark, crossFrom, crossCh, crossV, rangeFrom, rangeTo, single] = t
    if (tok === '(') { optional = true; continue }
    if (tok === ')') { optional = false; continue }
    if (chapterMark) { chapter = Number(chapterMark); continue }
    if (crossFrom) {
      const endCh = Number(crossCh)
      ref.ranges.push({
        startCh: chapter || endCh, startV: Number(crossFrom),
        endCh, endV: Number(crossV), optional,
      })
      chapter = endCh
      continue
    }
    if (rangeFrom) {
      if (chapter) {
        ref.ranges.push({ startCh: chapter, startV: Number(rangeFrom), endCh: chapter, endV: Number(rangeTo), optional })
      } else {
        // 장 단위 범위 (예: '시편 120-121')
        ref.ranges.push({ startCh: Number(rangeFrom), endCh: Number(rangeTo), optional })
      }
      continue
    }
    if (single) {
      if (chapter) {
        ref.ranges.push({ startCh: chapter, startV: Number(single), endCh: chapter, endV: Number(single), optional })
      } else {
        chapter = Number(single)
        ref.ranges.push({ startCh: chapter, endCh: chapter, optional })
      }
    }
  }

  return applyNumbering(ref)
}

/** 판본별 장 구분 차이를 공동번역 기준으로 맞춘다. */
function applyNumbering(ref: BibleRef): BibleRef {
  ref.ranges = ref.ranges.map((r) => {
    const start = shiftNumbering(ref.bookName, r.startCh, r.startV)
    const end = shiftNumbering(ref.bookName, r.endCh, r.endV)
    if (!start && !end) return r
    return {
      ...r,
      startCh: start?.chapter ?? r.startCh,
      startV: start ? start.verse : r.startV,
      endCh: end?.chapter ?? r.endCh,
      endV: end ? end.verse : r.endV,
    }
  })
  return ref
}

export interface PassageVerse {
  chapter: number
  number: number
  text: string
  paragraphBreak?: boolean
  optional?: boolean
}

export interface Passage {
  ref: BibleRef
  bookName: string
  verses: PassageVerse[]
  /** 본문을 가져오지 못한 이유 */
  error?: string
}

/** 행갈이를 살릴 성서 — 시편은 운문의 줄 나눔이 읽기에 낫다. */
const KEEP_LINE_BREAKS = new Set(['ps'])

/**
 * 한 절의 글.
 *
 * 공동번역은 욥기·시편 같은 운문의 행갈이를 본문 안에 줄바꿈으로 담고 있다.
 * 시편은 그대로 살리고, 다른 책은 독서가 지나치게 길어져 한 문단으로 이어 붙인다.
 */
function verseText(v: BibleVerse, keepLines: boolean) {
  const raw = v.segments.map((s) => s.text).join(keepLines ? '\n' : ' ').replace(/^¶\s*/, '')
  return (keepLines ? raw.replace(/[ \t]+/g, ' ') : raw.replace(/\s+/g, ' ')).trim()
}

/** 인용 범위에 해당하는 본문을 가져온다. */
export async function fetchPassage(raw: string): Promise<Passage> {
  const index = await bibleBookIndex()
  const ref = parseReference(raw, index)
  const book = ref.bookId ? index.get(ref.bookName) : null
  if (!ref.bookId || !book) {
    return { ref, bookName: ref.bookName, verses: [], error: `성서 권을 찾지 못했습니다: ${ref.bookName || raw}` }
  }
  const verses: PassageVerse[] = []
  const keepLines = KEEP_LINE_BREAKS.has(ref.bookId)
  try {
    for (const r of ref.ranges) {
      for (let ch = r.startCh; ch <= r.endCh; ch++) {
        if (ch < 1 || ch > book.chapter_count) continue
        const data = await loadChapter(ref.bookId, ch)
        const from = ch === r.startCh ? (r.startV ?? 1) : 1
        const to = ch === r.endCh ? (r.endV ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER
        for (const v of data.verses) {
          if (v.number < from || v.number > to) continue
          verses.push({
            chapter: ch,
            number: v.number,
            text: verseText(v, keepLines),
            paragraphBreak: v.segments.some((s) => s.paragraph_break),
            optional: r.optional,
          })
        }
      }
    }
  } catch (e) {
    return { ref, bookName: book.name_ko, verses, error: (e as Error).message }
  }
  return { ref, bookName: book.name_ko, verses }
}

/**
 * 절 번호 표시 — 장이 바뀌는 자리에는 장도 함께 적는다.
 *
 * '욥기 9:1, 10:1-9, 16-22'처럼 여러 장에 걸친 독서에서 절 번호만 있으면
 * 9장 1절과 10장 1절이 똑같이 '1'로 보여 헷갈린다.
 */
export function verseLabels(verses: PassageVerse[]): string[] {
  let chapter: number | null = null
  return verses.map((v) => {
    const label = v.chapter === chapter ? String(v.number) : `${v.chapter}:${v.number}`
    chapter = v.chapter
    return label
  })
}

/** 화면에 보여 줄 인용 표시 (예: '이사야 1:1-9') */
export function formatReference(ref: BibleRef, index: Map<string, BibleBook>): string {
  const full = index.get(ref.bookName)?.name_ko ?? ref.bookName
  return `${full} ${ref.raw.replace(/^[1-3]?\s*[가-힣]{2,4}\s*/, '')}`.trim()
}
