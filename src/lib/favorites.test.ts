import { describe, it, expect } from 'vitest'
import { tidyFavoriteText } from '../pages/FavoritesPage'

/**
 * 독서는 이어지는 산문이라 한 문단으로 보여 준다. 한때 공동번역의 운문 행갈이를,
 * 또 한때는 절마다 줄을 바꿔 담았던 적이 있어 이미 저장된 글도 함께 손질한다.
 */
describe('담아 둔 글 손질', () => {
  const legacyPoetry = [
    '9:1 욥이 다시 말을 받았다.',
    '10:1 숨쉬는 일이 이다지도 괴로워서',
    '나의 슬픔을 하느님께 아뢰고',
    '2 나 이제 하느님께 아룁니다.',
  ].join('\n')

  it('독서는 한 문단으로 이어 붙인다', () => {
    expect(tidyFavoriteText(legacyPoetry, 'reading', '욥기 9:1, 10:1-9, 16-22')).toBe(
      '9:1 욥이 다시 말을 받았다. 10:1 숨쉬는 일이 이다지도 괴로워서 나의 슬픔을 하느님께 아뢰고 2 나 이제 하느님께 아룁니다.',
    )
  })

  it('절마다 줄을 바꿔 담아 둔 예전 항목도 이어 붙인다', () => {
    const perVerse = '18:16 육백 명 무장대로 하여금 대문을 지키도록 하였다.\n17 그 땅을 돌아보고 온 다섯 사람이'
    expect(tidyFavoriteText(perVerse, 'reading', '판관기 18:16-31')).toBe(
      '18:16 육백 명 무장대로 하여금 대문을 지키도록 하였다. 17 그 땅을 돌아보고 온 다섯 사람이',
    )
  })

  it('시편은 줄 나눔을 그대로 둔다', () => {
    const psalm = '1 주님은 나의 목자시니 ○ 아쉬울 것 없어라.\n2 푸른 풀밭에 누워 놀게 하시고'
    expect(tidyFavoriteText(psalm, 'psalm', '시편 23편')).toBe(psalm)
    expect(tidyFavoriteText(legacyPoetry, 'reading', '시편 23')).toBe(legacyPoetry)
  })

  it('이미 한 문단인 글은 건드리지 않는다', () => {
    const one = '1 한처음에 하느님께서 하늘과 땅을 지어내셨다. 2 땅은 아직 모양을 갖추지 않고'
    expect(tidyFavoriteText(one, 'reading', '창세기 1:1-2')).toBe(one)
  })
})

