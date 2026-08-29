/**
 * 「대한성공회 기도서」(2004) 성서정과 원문의 확인된 오식(誤植)과 그 교정.
 *
 * 원문을 함부로 바꾸지 않기 위해, 앱은 원문 표기를 그대로 보여 주면서
 * 실제 본문만 교정된 인용으로 가져오고 화면에 그 사실을 알린다.
 */
export interface Erratum {
  /** 성서정과에 인쇄된 그대로의 표기 */
  printed: string
  /** 본문을 가져올 때 사용할 교정 표기 */
  corrected: string
  reason: string
  page: number
}

export const ERRATA: Erratum[] = [
  {
    printed: '전도 43:1-12, 27-32',
    corrected: '집회 43:1-12, 27-32',
    reason: '영어 원표의 Ecclesiasticus(집회서)를 전도서로 옮긴 것으로 보인다. 전도서는 12장까지뿐이다.',
    page: 498,
  },
]

const BY_PRINTED = new Map(ERRATA.map((e) => [e.printed, e]))

/** 인쇄된 표기에 알려진 오식이 있으면 교정본을 돌려준다. */
export function correctReference(printed: string): Erratum | undefined {
  return BY_PRINTED.get(printed.trim())
}

/**
 * 장절 번호 체계 차이 보정.
 *
 * 기도서 성서정과는 개신교식 장 구분을 쓰는 대목이 있는데, 「공동번역성서」는
 * 칠십인역 계열 구분을 따른다. 오식이 아니라 판본 차이이므로 따로 다룬다.
 *  · 말라기  개신교 4:1-6  = 공동번역 3:19-24
 *  · 요엘    개신교 2:28-32 = 공동번역 3:1-5 / 개신교 3장 = 공동번역 4장
 */
export interface ChapterShift {
  fromChapter: number
  toChapter: number
  /** 절 번호에 더할 값 */
  verseOffset: number
  /** fromChapter 안에서 이 절 이상일 때만 적용 */
  minVerse?: number
  note: string
}

export const NUMBERING: Record<string, ChapterShift[]> = {
  말라: [{ fromChapter: 4, toChapter: 3, verseOffset: 18, note: '공동번역 말라기는 3장까지이며 개신교 4:1-6이 3:19-24에 해당한다' }],
  요엘: [
    { fromChapter: 2, toChapter: 3, verseOffset: -27, minVerse: 28, note: '개신교 요엘 2:28-32는 공동번역 3:1-5이다' },
    { fromChapter: 3, toChapter: 4, verseOffset: 0, note: '개신교 요엘 3장은 공동번역 4장이다' },
  ],
}

/** 필요한 경우 장·절 번호를 공동번역 체계로 옮긴다. */
export function shiftNumbering(bookName: string, chapter: number, verse?: number) {
  for (const s of NUMBERING[bookName] ?? []) {
    if (s.fromChapter !== chapter) continue
    if (s.minVerse !== undefined && (verse ?? 1) < s.minVerse) continue
    return { chapter: s.toChapter, verse: verse === undefined ? undefined : verse + s.verseOffset, note: s.note }
  }
  return null
}
