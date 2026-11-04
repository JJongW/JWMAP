#!/usr/bin/env python3
"""
카드뉴스 툴팁 자리 고르기: 사진을 가리지 않는 곳을 찾는다.

  /usr/bin/python3 scripts/card-tooltip-place.py <사진> <툴팁 너비> <툴팁 높이> [--avoid x,y,w,h ...]

카드는 3240x4050, 사진은 Figma FILL(가운데 기준으로 꽉 채워 자름)로 들어간다고 본다.
사진 위에서 "복잡한 정도"(가장자리 세기 + 밝기 변화)를 재고, 툴팁이 덮는 곳의 복잡도가
가장 낮은 자리를 고른다. 사진 가운데(피사체가 보통 있는 곳)는 점수를 더 나쁘게 친다.
툴팁은 본문 여백(295px) 안쪽에만 둔다. 카드 끝에 붙이면 화면 가장자리에서 가려지기 쉽다.
결과는 JSON 한 줄: {"x":..,"y":..,"align":"left|right|inset","score":..}
"""
import json
import sys

from PIL import Image, ImageFilter, ImageOps

W, H = 3240, 4050
MARGIN = 295           # 템플릿 본문 여백
TOP, BOTTOM = 520, 3554  # 닉네임 아래 ~ 장소 소개 글 아래 끝 (인스타 하단 UI·손가락에 가리지 않게)
GRID = 30              # 계산용 축소 배율 (1칸 = 30px)


def busy_map(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert('L')
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)))
    left, top = (im.width - W) // 2, (im.height - H) // 2
    im = im.crop((left, top, left + W, top + H)).resize((W // GRID, H // GRID))
    edges = im.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.BoxBlur(2))
    blur = im.filter(ImageFilter.BoxBlur(3))
    w, h = im.size
    px, ex, bx = im.load(), edges.load(), blur.load()
    grid = [[0.0] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            local = abs(px[x, y] - bx[x, y])            # 질감
            cx, cy = (x / w - 0.5) * 2, (y / h - 0.5) * 2
            center = max(0.0, 1 - (cx * cx + cy * cy) ** 0.5)  # 가운데일수록 1
            grid[y][x] = ex[x, y] + local + 60 * center
    return grid


def best(path, tw, th, avoid):
    g = busy_map(path)
    gh, gw = len(g), len(g[0])
    # 합 배열로 박스 평균을 빠르게
    S = [[0.0] * (gw + 1) for _ in range(gh + 1)]
    for y in range(gh):
        row = 0.0
        for x in range(gw):
            row += g[y][x]
            S[y + 1][x + 1] = S[y][x + 1] + row

    def box(x, y, w, h):
        x0, y0 = max(0, x // GRID), max(0, y // GRID)
        x1, y1 = min(gw, (x + w) // GRID + 1), min(gh, (y + h) // GRID + 1)
        n = max(1, (x1 - x0) * (y1 - y0))
        return (S[y1][x1] - S[y0][x1] - S[y1][x0] + S[y0][x0]) / n

    def hits(x, y):
        return any(x < ax + aw + 60 and ax < x + tw + 60 and y < ay + ah + 60 and ay < y + th + 60
                   for ax, ay, aw, ah in avoid)

    xs = {'left': [MARGIN], 'right': [W - MARGIN - tw], 'inset': list(range(MARGIN + 60, W - MARGIN - tw, 60))}
    cands = []
    for align, xl in xs.items():
        for x in xl:
            for y in range(TOP, BOTTOM - th + 1, 30):
                if hits(x, y):
                    continue
                cands.append((box(x, y, tw, th), x, y, align))
    score, x, y, align = min(cands)
    return {'x': x, 'y': y, 'align': align, 'score': round(score, 1)}


if __name__ == '__main__':
    a = sys.argv[1:]
    avoid = []
    while '--avoid' in a:
        i = a.index('--avoid')
        avoid.append(tuple(int(v) for v in a[i + 1].split(',')))
        del a[i:i + 2]
    print(json.dumps(best(a[0], int(a[1]), int(a[2]), avoid)))
