"""scripts/jua-subset.mjs가 부른다. Jua 부분 글꼴과 Pretendard(wght 400)의 폭·세로 값을 비교해 대체 글꼴 값을 JSON으로 낸다.

    python jua-fallback-metrics.py <jua-subset.woff2> <PretendardVariable.ttf> <글자 목록 파일>

size-adjust: 고정 문구(글자 목록 파일의 줄)를 모두 그린 폭의 비(Jua / Pretendard).
ascent/descent/line-gap-override: Jua의 typo 값(USE_TYPO_METRICS)을 size-adjust로 나눈 값(Next adjustFontFallback과 같은 식).
"""
import json
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

jua_path, pretendard_path, text_path = sys.argv[1:4]
lines = [line for line in open(text_path, encoding="utf-8").read().splitlines() if line]
jua = TTFont(jua_path)
pretendard = instantiateVariableFont(TTFont(pretendard_path), {"wght": 400})


def width(font):
    cmap, hmtx, upm = font.getBestCmap(), font["hmtx"], font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(c)]][0] for line in lines for c in line) / upm


size_adjust = width(jua) / width(pretendard)
os2, upm = jua["OS/2"], jua["head"].unitsPerEm
print(json.dumps({
    "sizeAdjust": size_adjust,
    "ascentOverride": os2.sTypoAscender / upm / size_adjust,
    "descentOverride": -os2.sTypoDescender / upm / size_adjust,
    "lineGapOverride": os2.sTypoLineGap / upm / size_adjust,
}))
