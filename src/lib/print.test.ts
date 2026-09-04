import { describe, it, expect } from 'vitest'
import { describeDay } from './churchCalendar'
import { monthPrintTitle, needsPortraitPrint, officePrintTitle } from './print'
import { referenceFileName } from './shareCard'

describe('인쇄·PDF 파일 이름', () => {
  it('날짜 · 교회력 · 예식을 담는다', () => {
    expect(officePrintTitle(describeDay('2026-08-29'), '아침기도'))
      .toBe('2026-08-29 연중 21주 토요일 아침기도')
    expect(officePrintTitle(describeDay('2025-11-30'), '저녁기도'))
      .toBe('2025-11-30 대림 1주일 저녁기도')
    expect(monthPrintTitle('2026-08')).toBe('2026-08 성무일과 독서목록')
  })

  it('파일 이름에 쓸 수 없는 글자가 들어가지 않는다', () => {
    for (const iso of ['2026-01-06', '2026-04-05', '2026-05-24', '2026-11-22']) {
      const title = officePrintTitle(describeDay(iso), '아침기도')
      expect(title).not.toMatch(/[\\/:*?"<>|]/)
    }
  })
})

describe('공유카드 파일 이름', () => {
  it('파일 이름에 쓸 수 없는 쌍점을 우리말 표기로 바꾼다', () => {
    expect(referenceFileName('판관기 16:15-31')).toBe('판관기 16장 15-31절')
    expect(referenceFileName('욥기 9:1, 10:1-9, 16-22')).toBe('욥기 9장 1절, 10장 1-9절, 16-22')
    expect(referenceFileName('시편 119:105-112편')).toBe('시편 119편 105-112절')
    // 이미 우리말 표기인 것은 그대로 둔다
    expect(referenceFileName('시편 20편')).toBe('시편 20편')
    expect(referenceFileName('아침기도 155쪽')).toBe('아침기도 155쪽')
  })

  it('결과에 파일 이름으로 못 쓰는 글자가 남지 않는다', () => {
    for (const r of ['판관기 16:15-31', '욥기 9:1, 10:1-9, 16-22', '시편 119:105-112편', '1고린 10:14-17, 11:27-32']) {
      expect(referenceFileName(r)).not.toMatch(/[\\/:*?"<>|]/)
    }
  })
})

describe('용지 방향을 못 바꾸는 브라우저 가리기', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const IPAD_OLD = 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'

  it('iOS는 세로로 인쇄한다', () => {
    expect(needsPortraitPrint(IPHONE, true)).toBe(true)
    expect(needsPortraitPrint(IPAD_OLD, true)).toBe(true)
    // iPadOS 13+ 는 데스크톱 사파리와 같은 UA를 보내므로 터치로 가른다
    expect(needsPortraitPrint(MAC, true)).toBe(true)
  })

  it('용지 방향을 지정할 수 있는 브라우저는 그대로 가로 인쇄한다', () => {
    expect(needsPortraitPrint(MAC, false)).toBe(false)
    expect(needsPortraitPrint(WIN, false)).toBe(false)
    expect(needsPortraitPrint(ANDROID, false)).toBe(false)
  })
})
