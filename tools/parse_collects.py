# -*- coding: utf-8 -*-
"""주일 본기도(41~84쪽) → 구조화 JSON.

성무일과 예식문은 「교회력에 따른 오늘의 본기도를 드린다」고만 적어 두고, 정작
기도문은 39~110쪽에 따로 실려 있다. 그 가운데 날마다 쓰이는 주일 본기도를 뽑는다.

  절기 표제(큰 지시문)   대림절기 · 성탄절기 · 사순절기 · 부활절기 · 연중시기
  날 표제               대림 1주일 / 연중 10주일(6월 5일과 11일 사이의 주일)
  주기 표제(작은 지시문)  가해 · 나해 · 다해 · 주간 · 가, 나, 다해
  본문                  첫 줄만 들여쓰고 이어지는 줄은 판면 오른쪽까지 찬다
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pdfplumber
from extract import page_lines
from joinwords import join as join_lines

SRC = "TalkFile_성공회-기도서2004년-판 (1) (2).pdf"
FIRST, LAST = 41, 84

SEASONS = {"대림절기", "성탄절기", "사순절기", "부활절기", "연중시기"}
CYCLE = {"가해": "가", "나해": "나", "다해": "다", "주간": "주간", "가, 나, 다해": "전부",
         "가,나,다해": "전부"}
FOOTER = re.compile(r"^\d{2,3}\s*본기도$|^주일본기도\s*\d{2,3}$|^\d{2,3}$|^본기도$")
NUMBERED = re.compile(r"^(\d)\)\s*")


def is_cycle(t):
    return CYCLE.get(re.sub(r"\s*공통$", "", t).replace(" ", "").replace("가,나,다해", "가, 나, 다해"))


def main():
    lines = []
    with pdfplumber.open(SRC) as pdf:
        for pno in range(FIRST, LAST + 1):
            for l in page_lines(pdf.pages[pno - 1]):
                t = l["text"].strip()
                # 쪽머리와 부 제목(「주일 본기도」 등)은 본문이 아니다
                if t and not FOOTER.match(t) and not (l["size"] >= 20 and not l["rubric"]):
                    lines.append({**l, "text": t, "page": pno})

    def next_meaningful(i):
        return lines[i + 1] if i + 1 < len(lines) else None

    collects, season, cur, cycle, prev_full = [], None, None, None, False
    rubric_open = False   # 앞 줄이 판면을 채운 지시문인가 (이어지는 줄을 가리려고)
    for i, l in enumerate(lines):
        t = l["text"]

        if l["rubric"] and t in SEASONS:
            season, cur, cycle, prev_full = t, None, None, False
            rubric_open = False
            continue
        if is_cycle(t):
            if cur is None:
                continue
            cycle = {"cycle": is_cycle(t), "texts": []}
            cur["cycles"].append(cycle)
            prev_full, rubric_open = False, False
            continue
        # 지시문이 두 줄로 이어질 때 뒷줄은 붉은 글씨로 찍히지 않는 곳이 있다.
        # 본문은 17.5pt, 지시문은 15pt이지만 「성탄 밤」처럼 15pt인 표제도 있으므로,
        # 앞 줄이 판면을 채운 지시문이거나 문장으로 끝나면 지시문으로 본다.
        if l["rubric"] or (l["size"] < 16 and (rubric_open or t.endswith("."))):
            if cur is not None and not cur["cycles"]:
                cur["rubric"] = t if not cur.get("rubric") else join_lines(cur["rubric"], t)
            prev_full, rubric_open = False, l["full"]
            continue

        # 날 표제인가 — 문장으로 끝나지 않고, 바로 뒤에 주기 표제나 들여쓴 첫 줄이 온다.
        # (표제 앞 줄이 판면을 꽉 채우는 바람에 이어지는 줄로 오인되는 것을 막는다)
        nxt = next_meaningful(i)
        heading = (
            not t.endswith(".")
            and l["x0"] <= 88
            and nxt is not None
            and (bool(nxt["rubric"]) or nxt["x0"] > 88 or nxt["text"].startswith("("))
        )

        if not heading and cur is not None:
            if cycle is None:                      # 주기 표제 없이 바로 기도문이 오는 날
                cycle = {"cycle": "전부", "texts": []}
                cur["cycles"].append(cycle)
            if cycle["texts"] and prev_full:
                cycle["texts"][-1] = join_lines(cycle["texts"][-1], t)
            else:
                cycle["texts"].append(NUMBERED.sub("", t))
            prev_full, rubric_open = l["full"], False
            continue

        if t.startswith("(") and collects and not collects[-1]["cycles"]:  # noqa: SIM102
            collects[-1]["day"] += " " + t          # 두 줄로 나뉜 표제
            cur = collects[-1]
            cycle, prev_full = None, False
            continue

        cur = {"season": season, "day": t, "page": l["page"], "rubric": None, "cycles": []}
        collects.append(cur)
        cycle, prev_full, rubric_open = None, False, False

    # 교회력과 이어 붙일 열쇠를 달아 둔다. 「연중 22주일(8월 28일과…)」 → ordinary/22
    SEASON_KEY = {"대림절기": "advent", "성탄절기": "christmas", "사순절기": "lent",
                  "부활절기": "easter", "연중시기": "ordinary"}
    WEEKLY = re.compile(r"^(대림|성탄|사순|부활|연중)\s*(\d{1,2})\s*주일")
    for c in collects:
        c["name"] = re.sub(r"\s*\(.*$", "", c["day"]).strip()
        m = WEEKLY.match(c["day"])
        if m:
            c["key"] = {"season": SEASON_KEY[m.group(1) + "절기" if m.group(1) != "연중" else "연중시기"],
                        "week": int(m.group(2))}
        elif c["day"].startswith("부활주일"):
            c["key"] = {"season": "easter", "week": 1}
        else:
            c["key"] = None

    out = {"source": "대한성공회 기도서(2004) 41~84쪽 「주일 본기도」", "collects": collects}
    with open("public/data/collects.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f"본기도 {len(collects)}일치")
    for c in collects:
        cy = ", ".join(f"{x['cycle']}({len(x['texts'])})" for x in c["cycles"])
        print(f"  {c['page']:3}쪽 [{c['season'] or '?':6}] {c['day'][:44]:46} {cy}")


if __name__ == "__main__":
    main()
