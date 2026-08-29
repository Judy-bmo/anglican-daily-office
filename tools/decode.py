"""Unidocs-Korea1 CID → 유니코드 디코더.

대한성공회 기도서(2004) PDF는 Unidocs-Korea1 CID 컬렉션을 Identity-H로 임베드했고
ToUnicode CMap이 없다. 실측 결과 배열이 Adobe-Korea1과 호환되어 아래 규칙으로 복원한다.
  · CID 1~94      : ASCII (CID = 코드포인트 − 31)
  · CID 1086~3435 : KS X 1001 완성형 한글 2350자 (EUC-KR 배열 순서)
  · 그 밖의 기호   : 실측으로 개별 확인 (SYMBOLS)
"""

KS_HANGUL = []
for _hi in range(0xB0, 0xC9):
    for _lo in range(0xA1, 0xFF):
        try:
            KS_HANGUL.append(bytes([_hi, _lo]).decode("euc-kr"))
        except Exception:
            pass
HANGUL_BASE = 1086
assert len(KS_HANGUL) == 2350 and KS_HANGUL[0] == "가"

# PDF 페이지를 직접 렌더링해 눈으로 확인한 기호들
SYMBOLS = {
    106: "…",
    114: "‘", 115: "’",     # ‘ ’
    116: "“", 117: "”",     # “ ”
    159: "○",                          # 선창(사제/선창자)
    160: "●",                          # 응답(회중)
    227: "◎",
    244: "¶", 245: "†", 246: "‡",
    8587: "✛",                         # 성서정과: 아침시편 ✛ 저녁시편 구분자
    8655: "✠",                         # 축복 시 십자 표시
}

# 응답 구조 기호 (파서에서 화자 구분에 사용)
VERSICLE, RESPONSE = "○", "●"


def decode_cid(n: int):
    if 1 <= n <= 94:
        return chr(n + 31)
    if HANGUL_BASE <= n < HANGUL_BASE + 2350:
        return KS_HANGUL[n - HANGUL_BASE]
    return SYMBOLS.get(n)
