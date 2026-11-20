"""Merge curated Hong Kong & Shenzhen Xiaohongshu spots from ../xhs/outputs/map-data.json into public/data/xhs-spots.json and deduplicate."""
import json
import math
import os
import pathlib
import re

R = pathlib.Path(__file__).resolve().parents[1]
XHS_DATA = pathlib.Path(os.environ.get('XHS_MAP_DATA') or (R.parent / 'xhs/outputs/map-data.json'))
OUT = R / 'public/data/xhs-spots.json'

VALID_CATS = {
    '吃喝探店', '咖啡甜品', '艺术看展', '户外自然', '酒吧饮品',
    '旅行', '机位与拍照', '超市', '商场', '医院', '校园设施', '待分类',
}
EXPLANATORY_PAREN_RE = re.compile(r'[（(][^）)]*(?:正文|原设计展|原笔记|原帖|参考点|挂标|合集)[^）)]*[）)]$')


def in_city_bounds(lng: float, lat: float, city: str) -> bool:
    if city == 'sz':
        return 113.75 < lng < 114.68 and 22.40 < lat < 22.86
    return 113.8 < lng < 114.45 and 22.15 < lat < 22.6


def haversine_m(a: list[float], b: list[float]) -> float:
    rad = math.pi / 180
    dlat = (b[1] - a[1]) * rad
    dlon = (b[0] - a[0]) * rad
    h = math.sin(dlat / 2) ** 2 + math.cos(a[1] * rad) * math.cos(b[1] * rad) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def norm_name(n: str) -> str:
    return re.sub(r'[\s()（）·\-—/]+', '', n).lower()


def base_name(n: str) -> str:
    return EXPLANATORY_PAREN_RE.sub('', n).strip()


def spot_score(spot: dict, idx: int) -> tuple:
    name = spot.get('name', '')
    return (
        spot.get('category') != '待分类',
        not bool(EXPLANATORY_PAREN_RE.search(name)),
        bool(spot.get('hours')),
        bool(spot.get('geometry')),
        len(spot.get('address', '')),
        -idx,
    )


def dedupe_spots(spots: list[dict]) -> tuple[list[dict], int]:
    """Merge duplicate same-city XHS spots while keeping OSM and campus layers isolated."""
    used: set[int] = set()
    kept_indices: list[int] = []
    removed = 0

    for i, a in enumerate(spots):
        if i in used:
            continue
        group = [i]
        na, ba = norm_name(a['name']), norm_name(base_name(a['name']))
        a_is_osm = str(a['id']).startswith('osm-')
        a_is_campus = a.get('category') == '校园设施'
        for j in range(i + 1, len(spots)):
            if j in used:
                continue
            b = spots[j]
            if a['city'] != b['city']:
                continue
            if (str(b['id']).startswith('osm-') != a_is_osm) or ((b.get('category') == '校园设施') != a_is_campus):
                continue
            nb, bb = norm_name(b['name']), norm_name(base_name(b['name']))
            d = haversine_m(a['coordinates'], b['coordinates'])
            if (na == nb and d < 500) or (ba == bb and len(ba) >= 2 and d < 60):
                group.append(j)
                used.add(j)
        used.add(i)
        winner = max(group, key=lambda idx: spot_score(spots[idx], idx))
        kept_indices.append(winner)
        removed += len(group) - 1

    return [spots[idx] for idx in sorted(kept_indices)], removed


def main():
    existing = json.loads(OUT.read_text()) if OUT.exists() else []
    seen = {s['id'] for s in existing}
    added = []

    if XHS_DATA.exists():
        raw = json.loads(XHS_DATA.read_text())
        rows = raw if isinstance(raw, list) else raw.get('rows') or raw.get('notes') or raw.get('items') or []
        for r in rows:
            locs = [l for l in (r.get('locations') or []) if l.get('lat') and (l.get('lng') or l.get('lon'))]
            for idx, l in enumerate(locs):
                lng = float(l.get('lng') or l.get('lon'))
                lat = float(l['lat'])
                if not (113.75 < lng < 114.68 and 22.15 < lat < 22.86):
                    continue
                addr = str(l.get('address') or '')
                name = str(l.get('name') or '未命名地点').strip()
                if '深圳' in addr or '广东省' in addr:
                    city = 'sz'
                elif '香港' in addr or any(k in name for k in ('香港', 'M+', '大馆', 'Fiata', 'Pizza Project', 'H Queen')):
                    city = 'hk'
                else:
                    city = 'hk' if lat < 22.52 and lng < 114.45 else 'sz'
                if not in_city_bounds(lng, lat, city):
                    continue
                sid = f"xhs-{r['id']}-{idx}"
                if sid in seen:
                    continue
                seen.add(sid)
                raw_cat = str(r.get('category') or '吃喝探店')
                cat = raw_cat if raw_cat in VALID_CATS else '待分类'
                added.append({
                    'id': sid,
                    'city': city,
                    'name': name,
                    'category': cat,
                    'coordinates': [round(lng, 6), round(lat, 6)],
                    'address': addr,
                    'source': str(l.get('source') or ''),
                    'sourceUrl': str(l.get('source_url') or ''),
                    'noteId': str(r['id']),
                    'noteTitle': str(r.get('title') or ''),
                    'noteUrl': str(r.get('url') or ''),
                    'snippet': ' '.join(str(r.get('content') or '').split())[:200],
                })

    merged, deduped = dedupe_spots(existing + added)
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    hk = sum(1 for s in merged if s['city'] == 'hk')
    sz = sum(1 for s in merged if s['city'] == 'sz')
    hk_new = sum(1 for s in added if s['city'] == 'hk')
    sz_new = sum(1 for s in added if s['city'] == 'sz')
    print(f'Added {len(added)} new XHS spots (+{hk_new} HK, +{sz_new} SZ), removed {deduped} duplicates. Total: {len(merged)} ({hk} HK, {sz} SZ) -> {OUT}')


if __name__ == '__main__':
    main()
