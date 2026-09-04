# -*- coding: utf-8 -*-
"""성무일과 송가(180~189쪽) → 구조화 JSON.

180쪽 지시: "모든 독서 후에는 송가를 한다. 다양한 송가의 사용을 원하면 아래표를
따라서 181-189쪽에 있는 송가 중에 하나를 선택할 수 있다. 독서가 하나일 경우
첫 번째 송가를 한다."

그래서 두 가지를 뽑는다.
  · 송가 본문 — 181~189쪽의 열 편, 그리고 예식문 안에 있는 복음송가 셋
  · 배정표   — 요일(및 대축일)과 절기에 따라 어느 송가를 쓰는지 (180~181쪽)
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from extract import page_lines
from joinwords import join as join_lines

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
TABLE = (180, 181)          # 요일·절기별 배정표
BODY = (181, 189)           # 송가 열 편
GOSPEL = [(152, 153), (163, 165)]   # 예식문 안의 복음송가 (즈가리야·성모 마리아·시므온)

HEAD = re.compile(r"^(\d{1,2})\)\s*(.+)$")
VERSE = re.compile(r"^(\d{1,3})\s+(?=\S)")
GLORIA = re.compile(r"^[◎●]")
FOOTER = re.compile(r"^\d{2,3}\s*성무일과$|^성무일과\s*송가\s*\d{2,3}$|^\d{2,3}$|^성무일과$")
# 제목 줄: "모세송가 Cantemus Domino\t출애 15:1-6" — 라틴어 이름과 성서 출처가 붙는다
TITLE = re.compile(r"^([가-힣][가-힣\s]*?(?:송가|하느님))\s*([A-Za-z][A-Za-z,\s.]*)?\s*(?:\t\s*(.+))?$")


def parse_canticles(pdf, first, last, want=None):
    out, cur, prev = [], None, None
    for pno in range(first, last + 1):
        for l in page_lines(pdf.pages[pno - 1]):
            t = l["text"].strip()
            if not t or FOOTER.match(t):
                continue
            m = HEAD.match(t)
            if m and l["size"] < 16.5:
                body = m.group(2).strip()
                tm = TITLE.match(body)
                if not tm:
                    continue
                name = re.sub(r"\s+", " ", tm.group(1)).strip()
                if want is not None and name not in want:
                    cur = None; prev = None
                    continue
                cur = {"name": name, "latin": (tm.group(2) or "").strip() or None,
                       "ref": (tm.group(3) or "").strip() or None,
                       "page": pno, "rubric": None, "verses": []}
                out.append(cur); prev = None
                continue
            if cur is None:
                continue
            if l["rubric"]:
                if not cur["verses"] and cur["rubric"] is None:
                    cur["rubric"] = t          # "특별히 부활절기에 적합하다."
                continue
            if GLORIA.match(t):
                cur["verses"].append({"n": "◎", "text": t.lstrip("◎● ").strip()})
                prev = cur["verses"][-1]
                continue
            vm = VERSE.match(t)
            if vm:
                cur["verses"].append({"n": vm.group(1), "text": t[vm.end():].strip()})
                prev = cur["verses"][-1]
            elif prev is not None:
                prev["text"] = join_lines(prev["text"], t)
    return out


DAY = re.compile(r"^(\d)\.\s*(.+)$")
ROW = re.compile(r"^(?:\[(아침|저녁)\]\s*)?(통\s*상|대림절|사순절|부활절)\s*:\s*(.+)$")
DAY_KEY = {"주일": "sunday", "월요일": "monday", "화요일": "tuesday", "수요일": "wednesday",
           "목요일": "thursday", "금요일": "friday", "토요일": "saturday",
           "대축일, 주의 축일": "feast"}
SEASON_KEY = {"통상": "ordinary", "대림절": "advent", "사순절": "lent", "부활절": "easter"}


def parse_table(pdf):
    rows, day, office = [], None, None
    for pno in range(TABLE[0], TABLE[1] + 1):
        for l in page_lines(pdf.pages[pno - 1]):
            t = l["text"].strip()
            m = DAY.match(t)
            if m and m.group(2) in DAY_KEY:
                day, office = DAY_KEY[m.group(2)], None
                continue
            m = ROW.match(t)
            if m and day:
                if m.group(1):
                    office = "morning" if m.group(1) == "아침" else "evening"
                if not office:
                    continue
                names = [re.sub(r"\s*\(.*?\)", "", n).strip()
                         for n in m.group(3).split(",")]
                rows.append({"day": day, "office": office,
                             "season": SEASON_KEY[re.sub(r"\s+", "", m.group(2))],
                             "canticles": [n for n in names if n]})
    return rows


def main():
    with pdfplumber.open(SRC) as pdf:
        body = parse_canticles(pdf, *BODY)
        seen = {c["name"] for c in body}
        gospel = []
        for a, b in GOSPEL:
            for c in parse_canticles(pdf, a, b,
                                     want={"즈가리야송가", "성모 마리아송가", "성 시므온송가"}):
                if c["name"] not in seen:
                    seen.add(c["name"]); gospel.append(c)
        table = parse_table(pdf)

    canticles = body + gospel
    # 배정표는 「시므온송가」, 본문 제목은 「성 시므온송가」처럼 표기가 조금 다르다.
    # 표 쪽 이름을 본문 제목으로 맞춰 두어야 화면에서 이어 붙일 수 있다.
    names = [c["name"] for c in canticles]
    def canonical(n):
        if n in names:
            return n
        hit = [x for x in names if x.endswith(n) or n.endswith(x) or x.replace(" ", "") == n.replace(" ", "")]
        if len(hit) != 1:
            raise SystemExit(f"배정표의 「{n}」에 맞는 송가를 찾지 못했습니다: {hit}")
        return hit[0]
    for r in table:
        r["canticles"] = [canonical(n) for n in r["canticles"]]

    out = {"source": "대한성공회 기도서(2004) 180~189쪽 「성무일과 송가」",
           "canticles": canticles, "table": table}
    with open("public/data/canticles.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f"송가 {len(canticles)}편")
    for c in canticles:
        print(f"  {c['name']:14} {c['latin'] or '':28} 절 {len(c['verses']):2}  {c['ref'] or ''}")
    print(f"\n배정표 {len(table)}줄")
    for r in table:
        print(f"  {r['day']:9} {r['office']:7} {r['season']:8} {' / '.join(r['canticles'])}")


if __name__ == "__main__":
    main()
