# -*- coding: utf-8 -*-
"""「공동번역성서 개정판」 본문 내려받기.

대한성공회가 운영하는 공개 웹앱(bible.anglican.kr)의 장별 JSON을 그대로 받는다.
파이썬 표준 라이브러리의 TLS 조합이 이 서버와 맞지 않는 환경이 있어 curl을 쓴다.
서버에 부담을 주지 않도록 동시 요청을 4개로 제한한다.
"""
import json, subprocess, pathlib, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "bible"
BOOKS = ROOT / "public" / "data" / "bible-books.json"
BASE = "https://bible.anglican.kr/data"

OUT.mkdir(parents=True, exist_ok=True)
if not BOOKS.exists():
    subprocess.run(["curl", "-sSL", f"{BASE}/books.json", "-o", str(BOOKS)], check=True)

books = json.loads(BOOKS.read_text(encoding="utf-8"))
conf = ROOT / "scratch" / "curl-bible.conf"
conf.parent.mkdir(exist_ok=True)
lines = []
for b in books:
    chapters = [str(c) for c in range(1, b["chapter_count"] + 1)]
    if b.get("has_prologue"):
        chapters.append("prologue")
    for ch in chapters:
        lines.append(f'url = "{BASE}/bible/{b["id"]}-{ch}.json"')
        lines.append('output = "%s"' % (OUT / ("%s-%s.json" % (b["id"], ch))))
conf.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"내려받을 장: {len(lines)//2}")
subprocess.run(["curl", "-sS", "--parallel", "--parallel-max", "4", "--retry", "3",
                "--retry-delay", "2", "--max-time", "60",
                "-A", "daily-office-app (personal use)", "-K", str(conf)], check=True)
print(f"완료: {len(list(OUT.glob('*.json')))}개 파일")
