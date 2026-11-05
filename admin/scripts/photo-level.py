#!/usr/bin/env python3
"""
사진 수평·수직 맞추기: 기둥·창틀 같은 세로선이 똑바로 서도록 사진을 살짝 돌리고, 돌리며 생긴 빈 모서리를 잘라낸다.

  /usr/bin/python3 scripts/photo-level.py <입력> <출력> [--max 6]   # 결과 JSON: {"angle": 돌린 각도(반시계+), "gain": 정렬 개선 배율}

세로 가장자리 지도를 ±max도 범위로 돌려 보며, 가장자리가 세로 줄에 가장 많이 몰리는 각도를 고른다.
세로선이 약하면 가로선으로 판단하고, 둘 다 개선이 3% 미만이면 돌리지 않는다(angle 0).
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageOps


def best_angle(gray, max_deg, axis):
    """선 방향이 축과 맞을 때 가장자리가 한 줄(열/행)에 몰린다 → 투영 합의 제곱합이 최대인 회전각"""
    a = np.asarray(gray, dtype=np.float32)
    g = np.zeros_like(a)
    if axis == 'vertical':
        g[:, 1:-1] = np.abs(a[:, 2:] - a[:, :-2])
    else:
        g[1:-1, :] = np.abs(a[2:, :] - a[:-2, :])
    g[g < np.percentile(g, 90)] = 0
    # 가장자리 근처(잘린 테두리)는 빼고 가운데 90%만
    h, w = g.shape
    g[:, : w // 20] = 0
    g[:, -w // 20:] = 0
    g[: h // 20] = 0
    g[-h // 20:] = 0
    img = Image.fromarray(g)
    best, scores = 0.0, {}
    for i in range(int(-max_deg * 10), int(max_deg * 10) + 1, 2):
        d = i / 10
        r = np.asarray(img.rotate(d, resample=Image.BILINEAR), dtype=np.float32)
        prof = r.sum(axis=0 if axis == 'vertical' else 1)
        scores[d] = float((prof ** 2).sum())
    best = max(scores, key=scores.get)
    base = scores[0.0]
    gain = scores[best] / base if base else 1.0
    return best, gain


def tilt(gray, max_deg):
    dv, gv = best_angle(gray, max_deg, 'vertical')
    if gv > 1.03:
        return dv, gv, 'vertical'
    dh, gh = best_angle(gray, max_deg, 'horizontal')
    if gh > 1.03:
        return dh, gh, 'horizontal'
    return 0.0, max(gv, gh), 'none'


def inscribed(w, h, deg):
    """회전 후 빈 곳 없이 남는 가장 큰 같은 비율 사각형 크기"""
    t = math.radians(abs(deg))
    c, s = math.cos(t), math.sin(t)
    k = min(w / (w * c + h * s), h / (w * s + h * c))
    return int(w * k), int(h * k)


def main():
    a = sys.argv[1:]
    max_deg = 6.0
    if '--max' in a:
        i = a.index('--max')
        max_deg = float(a[i + 1])
        del a[i:i + 2]
    src, dst = a[0], a[1]
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    small = im.copy()
    small.thumbnail((900, 900))
    deg, n, by = tilt(small.convert('L'), max_deg)
    # 이미지 좌표는 y가 아래로 → 측정한 기울기만큼 PIL rotate(양수=반시계)로 되돌린다
    rot = deg if by != 'none' else 0.0
    if abs(rot) < 0.3:
        rot = 0.0
    if rot:
        r = im.rotate(rot, resample=Image.BICUBIC, expand=True)
        cw, ch = inscribed(im.width, im.height, rot)
        l, t = (r.width - cw) // 2, (r.height - ch) // 2
        im = r.crop((l, t, l + cw, t + ch))
    im.save(dst, quality=93)
    print(json.dumps({'angle': round(rot, 2), 'gain': round(n, 3), 'by': by, 'size': im.size}))


if __name__ == '__main__':
    main()
