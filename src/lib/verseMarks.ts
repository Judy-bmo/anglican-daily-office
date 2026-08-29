/**
 * 이어지는 산문 독서에서 절 번호를 골라낸다.
 *
 * 독서는 한 문단으로 이어 담기 때문에 절 번호가 본문 사이에 섞여 있다.
 * 본문 속 숫자(예: '육백 명'을 아라비아 숫자로 적은 곳)를 절 번호로 잘못 읽지 않도록,
 * 장:절 형태가 아니면 앞 절보다 크면서 너무 멀리 뛰지 않은 번호만 절 번호로 본다.
 */

/** 앞이 줄머리나 공백이고 뒤가 공백인 숫자 */
const INLINE_VERSE = /(^|\s)(\d{1,3}(?::\d{1,3})?)(?=\s)/g
/** 절 번호는 차례로 올라간다. 이보다 크게 건너뛰면 본문 속 숫자로 본다. */
const MAX_GAP = 25

export interface TextSegment {
  text: string
  /** 절 번호인가 */
  verse?: boolean
}

export function splitVerseMarks(text: string): TextSegment[] {
  const out: TextSegment[] = []
  let last = 0
  let cursor = 0
  for (const m of text.matchAll(INLINE_VERSE)) {
    const token = m[2]
    const n = Number(token.split(':').pop())
    if (!token.includes(':') && !(n > last && n - last <= MAX_GAP)) continue
    last = n
    const at = (m.index ?? 0) + m[1].length
    if (at > cursor) out.push({ text: text.slice(cursor, at) })
    out.push({ text: token, verse: true })
    cursor = at + token.length + 1      // 번호와 뒤따르는 공백까지 건너뛴다
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) })
  return out
}
