# -*- coding: utf-8 -*-
"""기도서 PDF → 앱 데이터 전체 파이프라인.

    .venv/bin/python tools/build.py

성서 본문(공동번역)은 별도로 내려받는다:
    python3 tools/fetch_bible.py
"""
import subprocess, sys, pathlib

STEPS = [
    ("성무일과 예식문 (147~190쪽)", "parse_offices.py"),
    ("성무일과 성서정과표 (484~524쪽)", "parse_lectionary.py"),
    ("시편 (526~764쪽)", "parse_psalter.py"),
    ("성무일과 송가 (180~189쪽)", "parse_canticles.py"),
    ("월별 축일 (32~38쪽)", "parse_feasts.py"),
]

root = pathlib.Path(__file__).resolve().parent.parent
for label, script in STEPS:
    print(f"\n▶ {label}")
    r = subprocess.run([sys.executable, str(root / "tools" / script)], cwd=root)
    if r.returncode:
        sys.exit(f"실패: {script}")
print("\n완료 — public/data/ 에 산출되었습니다.")
