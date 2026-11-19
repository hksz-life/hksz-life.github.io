"""Merge curated Hong Kong & Shenzhen Xiaohongshu spots from ../xhs/outputs/map-data.json into public/data/xhs-spots.json."""
import json
import pathlib

XHS_DATA = pathlib.Path('/Users/amadeus/Documents/ChatGPT/工具/xhs/outputs/map-data.json')
OUT = pathlib.Path(__file__).resolve().parents[1] / 'public/data/xhs-spots.json'

VALID_CATS = {
    '吃喝探店', '咖啡甜品', '艺术看展', '户外自然', '酒吧饮品',
    '旅行', '机位与拍照', '超市', '商场', '医院', '校园设施', '待分类',
}


def in_city_bounds(lng: float, lat: float, city: str) -> bool:
    if city == 'sz':
        return 113.75 < lng < 114.68 and 22.40 < lat < 22.86
    return 113.8 < lng < 114.45 and 22.15 < lat < 22.6


def main():
    existing = json.loads(OUT.read_text()) if OUT.exists() else []
    seen = {s['id'] for s in existing}

    raw = json.loads(XHS_DATA.read_text())
    rows = raw if isinstance(raw, list) else raw.get('rows') or raw.get('notes') or raw.get('items') or []
    added = []
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
    merged = existing + added
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    hk = sum(1 for s in merged if s['city'] == 'hk')
    sz = sum(1 for s in merged if s['city'] == 'sz')
    hk_new = sum(1 for s in added if s['city'] == 'hk')
    sz_new = sum(1 for s in added if s['city'] == 'sz')
    print(f'Added {len(added)} new XHS spots (+{hk_new} HK, +{sz_new} SZ). Total: {len(merged)} ({hk} HK, {sz} SZ) -> {OUT}')


if __name__ == '__main__':
    main()
