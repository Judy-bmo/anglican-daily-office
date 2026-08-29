# -*- coding: utf-8 -*-
"""월별 축일표(32~38쪽) → 구조화 JSON.

기도서 32쪽 범례: 큰 글씨에 밑줄 = 대축일, 고딕 큰 글씨체(붉은 글씨) = 주요축일,
바탕체 = 축일, 이탤릭체 = 기념일.
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from extract import char_text, _is_rubric
from joinwords import join as join_lines

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
FIRST, LAST = 32, 38
MONTH = re.compile(r"^(\d{1,2})\s*월\s*$")
DAY = re.compile(r"^(\d{1,2})\s*(?:[-~]\s*(\d{1,2}))?\s*일\s*(.*)$")
NOTE = re.compile(r"^[*※]\s*(.+)$")
FOOTER = re.compile(r"^교회력\s*\d{2}$|^\d{2}\s*교회력$|^\d{2}$")


def rows_of(page):
    rows = []
    for c in sorted(page.chars, key=lambda c: (c["top"], c["x0"])):
        if not c["text"].strip():
            continue
        mid = (c["top"] + c["bottom"]) / 2
        for r in rows:
            if abs(r["mid"] - mid) <= 4.2:
                r["chars"].append(c); break
        else:
            rows.append({"mid": mid, "chars": [c]})
    underlines = [(l["x0"], l["x1"], l["top"]) for l in page.lines]
    out = []
    for r in sorted(rows, key=lambda r: r["mid"]):
        cs = sorted(r["chars"], key=lambda c: c["x0"])
        gaps = [(b["x0"] - a["x1"]) / a["size"] for a, b in zip(cs, cs[1:])]
        rounded = [round(g, 2) for g in gaps]
        base = max(set(rounded), key=rounded.count) if rounded else 0
        parts = [char_text(cs[0])]
        for (a, b), g in zip(zip(cs, cs[1:]), gaps):
            if g > base + 0.12:
                parts.append(" ")
            parts.append(char_text(b))
        body = [c for c in cs if c["size"] > 16]          # 날짜 숫자는 작은 글씨
        out.append({
            "text": "".join(parts).strip(),
            "x0": round(cs[0]["x0"], 1),
            "size": round(max(c["size"] for c in cs), 1),
            "red": sum(1 for c in body if _is_rubric(c)) > max(1, len(body)) * 0.5,
            "italic": sum(1 for c in body if abs(c["matrix"][2]) > 0.5) > max(1, len(body)) * 0.5,
            "underline": any(abs(t - r["mid"]) < 14 and x0 < cs[-1]["x1"] and x1 > cs[0]["x0"]
                             for x0, x1, t in underlines),
        })
    return out


# 기도서 29쪽: 사도·복음사가 축일 등은 본문에서 주요축일로 규정한다.
MAJOR_BY_TEXT = re.compile(
    r"사도|복음사가|죄없는 어린이|성\s*요셉|막달라 마리아|성\s*스테파노|성십자가|"
    r"한인\s*순교자|성\s*니콜라|추수감사|설\s*명절|추석\s*명절")


def rank_of(row):
    if row["underline"]:
        return "principal"      # 대축일
    if row["red"]:
        return "major"          # 주요축일
    if row["italic"]:
        return "memorial"       # 기념일
    return "feast"              # 축일


def main():
    feasts, notes, month, prev = [], [], None, None
    with pdfplumber.open(SRC) as pdf:
        for pno in range(FIRST, LAST + 1):
            for row in rows_of(pdf.pages[pno - 1]):
                t = row["text"]
                if not t or FOOTER.match(t) or t.startswith("월별 축일"):
                    continue
                if row["size"] < 16 and "범례" not in t and t.startswith("큰 글씨"):
                    continue
                if m := MONTH.match(t):
                    month, prev = int(m.group(1)), None
                    continue
                if month is None:
                    continue
                if m := NOTE.match(t):
                    notes.append({"month": month, "text": m.group(1).strip()}); prev = None
                    continue
                if m := DAY.match(t):
                    name = m.group(3).strip()
                    rank = rank_of(row)
                    if rank == "feast" and MAJOR_BY_TEXT.search(name):
                        rank = "major"
                    f = {"month": month, "day": int(m.group(1)), "name": name,
                         "rank": rank, "page": pno}
                    if m.group(2):
                        f["dayEnd"] = int(m.group(2))
                    feasts.append(f); prev = f
                    continue
                if prev is not None and row["x0"] > 90:
                    # 같은 날짜에 딸린 둘째 항목 또는 이어지는 줄.
                    # 서체 등급이 다르면 언제나 별개 항목이다.
                    different = rank_of(row) != prev["rank"]
                    if different or (len(t) < 40 and not t.endswith(("다.", "다", ")"))):
                        feasts.append({"month": prev["month"], "day": prev["day"], "name": t,
                                       "rank": rank_of(row), "page": pno})
                    else:
                        prev["name"] = join_lines(prev["name"], t)
                    continue
                notes.append({"month": month, "text": t})

    json.dump({"source": "대한성공회 기도서(2004) 32~38쪽 「월별 축일」",
               "legend": {"principal": "대축일", "major": "주요축일",
                          "feast": "축일", "memorial": "기념일"},
               "feasts": feasts, "notes": notes},
              open("public/data/feasts.json", "w"), ensure_ascii=False, indent=1)
    from collections import Counter
    print("축일 수:", len(feasts), Counter(f["rank"] for f in feasts))
    print("이동/파생 안내:", len(notes))
    for f in feasts:
        if f["rank"] in ("principal", "major"):
            print(f"   [{f['rank']:>9}] {f['month']:>2}/{f['day']:<2} {f['name']}")


main()
