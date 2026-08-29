# 데이터 추출 노트

기도서 PDF에서 어떻게 원문을 되살렸는지, 그리고 각 산출물의 구조를 적어 둡니다.

## 1. 인코딩 역공학

PDF 안의 본문 서체는 다섯 벌 모두 `Unidocs-Korea1` CID 컬렉션의 CFF(CIDFontType0C)이며
Identity-H로 심어져 있고 ToUnicode CMap이 없습니다. 그래서 텍스트를 뽑으면 글리프 번호가
그대로 나옵니다.

임베드된 CFF를 fontTools로 열어 charset(GID→CID)을 확인하고, 성서정과 페이지처럼 숫자가
많은 곳의 CID 빈도를 보니 ASCII 구간이 Adobe-Korea1과 같았습니다. 한글 구간의 기준 CID는
KS X 1001 완성형 2,350자를 EUC-KR 배열 순서로 만들어 놓고 900–1400 범위를 훑으며
성서 권 이름이 가장 많이 나오는 값을 찾아 **1086 = '가'** 로 확정했습니다.

남은 기호는 14자뿐이라 해당 글리프만 오려 붙인 대조표를 만들어 눈으로 확인했습니다.

```
tools/decode.py   CID → 유니코드
tools/extract.py  좌표로 읽기 순서 복원 + 별색으로 지시문 판정
tools/tokens.py   x좌표 기반 열 분할 (성서정과 표용)
```

## 2. 띄어쓰기 복원

양쪽 맞추기 조판이라 줄 끝에 공백 글자가 남지 않습니다. 책 전체에서 *줄 안쪽에 온전히
들어 있던* 낱말만 모아 15,271개 어휘의 빈도표를 만들고 다음 규칙으로 판정합니다.

```
붙인 형태가 실제 낱말로 쓰인 적이 있으면        → 붙인다
한쪽이 독립 낱말로 쓰인 적이 없으면            → 붙인다 (잘린 조각)
  단, 앞이 조사로 끝나는 온전한 어절이면       → 띄운다
둘 다 독립 낱말이면                          → 띄운다
```

측정 정확도는 98.47%입니다. 남는 오차는 대개 한쪽으로 쏠립니다 — 앞 토막이 한 글자뿐이고
뒤 토막이 홀로는 어디에도 안 쓰이는 경우(`불` + `리우는`), 양쪽 다 증거가 없어 마지막
갈림길에서 띄우는 쪽으로 기울어 버립니다. 819쪽의 줄바꿈 7,984곳을 공동번역 성서
57만 어절과 다시 견주어 43곳을 찾아 `joinwords.py`의 `JOIN_OVERRIDE`에 손으로 적어
두었습니다. 표가 빠지면 `src/lib/spacing.test.ts`에서 걸립니다.

한편 책 자체가 들쭉날쭉한 곳(「즈가리야송가」와 「즈가리야 송가」가 모두 나옵니다)은
원문대로 두었습니다. 통일하면 기도서를 고치는 셈이 되기 때문입니다.

## 3. 산출물

### `public/data/offices.json`

```jsonc
{ "office": "morning", "title": "아침기도", "pages": [149, 156],
  "lectionaryLinked": true,          // 낮기도·밤기도는 false
  "blocks": [
    { "type": "rubric",   "text": "개회성가 또는 묵상으로 …", "page": 149 },
    { "type": "section",  "n": 1, "title": "시작송가", "page": 149 },
    { "type": "versicle", "marker": "†", "text": "주여, 우리 입을 열어 주소서.", "page": 149 },
    { "type": "response", "marker": "◎", "text": "우리가 주님을 찬미하리이다.", "page": 149 },
    { "type": "option",   "n": 1, "title": "시편 95편 Venite", "page": 149 },
    { "type": "verse",    "n": "1", "text": "어서 와 주님께 …", "page": 149 }
  ] }
```

### `public/data/lectionary.json`

```jsonc
{ "label": "연중 21주일(8.21-27) 토요일", "kind": "weekday", "page": 514,
  "season": "ordinary", "week": 21, "weekday": 6,
  "psalms": { "morning": "20, 21", "evening": "110, 116, 117", "raw": "시편 20, 21 ✛ …" },
  "readings": {
    "1": { "ot": "열왕상 7:51-8:21", "epistle": "사도 28:17-31", "gospel": "마르 14:43-52" },
    "2": { "ot": "욥기 9:1, 10:1-9, 16-22", "epistle": "사도 11:1-18", "gospel": "요한 8:12-20" }
  },
  "offices": { "morning": { "psalms": "28, 30", "readings": ["…"] } },  // 고난주일·부활주일·성탄주간 축일
  "alternates": ["요한 20:19-23"] }
```

`kind`는 다섯 가지입니다.

* `sunday` / `weekday` — 절기·주차·요일로 찾습니다.
* `date` — **12월 17일 ~ 1월 12일**은 요일이 아니라 날짜로 지정됩니다(기도서 484쪽).
* `special` — 재의 수요일, 성탄일, 공현일, 승천일, 각종 전일(前日) 등 고유 항목.
* `feast` — 524쪽 축일 성무일과 정과 (조/만 = 아침/저녁).

### `public/data/psalter.json`

```jsonc
{ "number": 23, "page": 556,
  "verses": [ { "n": "1", "text": "주님은 나의 목자시니 ○ 아쉬울 것 없어라." },
              { "n": "¶", "text": "당신의 막대기와 지팡이로 ○ …" } ],
  "gloria": "영광이 성부와 성자와 성령께 ○ 처음과 같이 …" }
```

기도서 526쪽 안내대로 `○`는 구절 중간 쉼, `:`는 긴 구절 끊음, `¶`는 한 절을 두 절로
나눈 표시입니다.

### `public/data/feasts.json`

```jsonc
{ "month": 1, "day": 6, "name": "공현일", "rank": "principal", "page": 32 }
```

등급은 조판으로 판정합니다 — 밑줄=대축일, 붉은 글씨=주요축일, 이탤릭=기념일, 나머지=축일.
여기에 기도서 29쪽이 본문으로 규정한 "사도들의 축일·복음사가 축일…"을 주요축일로 보탭니다.

### `public/data/bible/{책id}-{장}.json`

대한성공회 공개 웹앱의 형식을 그대로 씁니다. 절마다 `segments`(산문/운문)와 각주가 붙습니다.
기도서 약어와 웹앱 약어가 다른 곳은 `src/lib/bibleRef.ts`의 `ALIASES`에서 맞춥니다
(사무상 = 1사무, 열왕상 = 1열왕, 역대상 = 1역대, 마카상 = 1마카).

## 4. 다시 만들기

```bash
python3 -m venv .venv
.venv/bin/pip install pypdf pdfplumber fonttools pymupdf pillow
.venv/bin/python tools/build.py     # PDF가 저장소 루트에 있어야 합니다
python3 tools/fetch_bible.py
npm test
```
