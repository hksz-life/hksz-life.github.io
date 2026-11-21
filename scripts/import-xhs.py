"""Merge curated Hong Kong & Shenzhen Xiaohongshu spots from ../xhs/outputs/map-data.json into public/data/xhs-spots.json and deduplicate."""
import json
import math
import os
import pathlib
import re

R = pathlib.Path(__file__).resolve().parents[1]
XHS_DATA = pathlib.Path(os.environ.get('XHS_MAP_DATA') or (R.parent / 'xhs/outputs/map-data.json'))
CURATED_PHASE2 = pathlib.Path(__file__).resolve().parent / 'curated-phase2-spots.json'
OUT = R / 'public/data/xhs-spots.json'

VALID_CATS = {
    '吃喝探店', '咖啡甜品', '艺术看展', '户外自然', '酒吧饮品',
    '旅行', '机位与拍照', '超市', '商场', '医院', '校园设施', '待分类',
}
EXPLANATORY_PAREN_RE = re.compile(r'[（(][^）)]*(?:正文|原设计展|原笔记|原帖|参考点|挂标|合集)[^）)]*[）)]$')
OPTIONAL_META_KEYS = ('hours', 'foodGroups', 'foodCuisines', 'precision', 'status', 'statusNote', 'geometry', 'menuUrl', 'orderNote')


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


def is_duplicate_spot(a: dict, b: dict, na: str, ba: str, nb: str, bb: str, d: float) -> bool:
    if (na == nb and d < 500) or (ba == bb and len(ba) >= 2 and d < 60):
        return True
    if a.get('noteId') and a.get('noteId') == b.get('noteId') and d < 3000:
        if ba == bb and len(ba) >= 2:
            return True
        if len(ba) >= 4 and len(bb) >= 4 and (ba.startswith(bb) or bb.startswith(ba)):
            return True
        if na.startswith('527') and nb.startswith('527'):
            return True
    if ('527clafoutis' in na and '527clafoutis' in nb and d < 500) or ('527' in ba and '527' in bb and d < 800):
        return True
    return False


def dedupe_spots(spots: list[dict]) -> tuple[list[dict], list[str]]:
    """Merge duplicate same-city XHS spots while keeping OSM and campus layers isolated."""
    used: set[int] = set()
    kept_indices: list[int] = []
    removed_names: list[str] = []

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
            if is_duplicate_spot(a, b, na, ba, nb, bb, d):
                group.append(j)
                used.add(j)
        used.add(i)
        winner_idx = max(group, key=lambda idx: spot_score(spots[idx], idx))
        winner = dict(spots[winner_idx])
        for idx in group:
            if idx == winner_idx:
                continue
            loser = spots[idx]
            removed_names.append(f"{loser['name']} ({loser['id']} -> kept {winner['id']})")
            for key in OPTIONAL_META_KEYS:
                if not winner.get(key) and loser.get(key):
                    winner[key] = loser[key]
        spots[winner_idx] = winner
        kept_indices.append(winner_idx)

    return [spots[idx] for idx in sorted(kept_indices)], removed_names


def find_map_match(spot: dict, loc_by_sid: dict, loc_by_note: dict):
    sid = str(spot.get('id') or '')
    if sid in loc_by_sid:
        return loc_by_sid[sid]
    nid = str(spot.get('noteId') or '')
    cands = loc_by_note.get(nid, [])
    sb = norm_name(base_name(spot.get('name', '')))
    if not sb:
        return None, None
    for row, loc in cands:
        lb = norm_name(base_name(loc.get('name', '')))
        if not lb:
            continue
        if sb == lb or (
            len(sb) >= 3 and len(lb) >= 3 and (
                sb.startswith(lb) or lb.startswith(sb)
                or (len(sb) >= 4 and sb[:4] in lb)
                or (len(lb) >= 4 and lb[:4] in sb)
            )
        ):
            return row, loc
    return None, None


def enrich_spots_from_map_data(spots: list[dict], rows: list[dict]) -> dict:
    loc_by_sid: dict[str, tuple[dict, dict]] = {}
    loc_by_note: dict[str, list[tuple[dict, dict]]] = {}
    for row in rows:
        nid = str(row.get('id') or '')
        if not nid:
            continue
        for idx, loc in enumerate(row.get('locations') or []):
            loc_by_sid[f'xhs-{nid}-{idx}'] = (row, loc)
            loc_by_note.setdefault(nid, []).append((row, loc))

    stats = {'foodGroups': 0, 'foodCuisines': 0, 'precision': 0, 'status': 0}
    for spot in spots:
        if not str(spot.get('id', '')).startswith('xhs-'):
            continue
        row, loc = find_map_match(spot, loc_by_sid, loc_by_note)
        loc = loc or {}
        single_loc = bool(row) and len(row.get('locations') or []) <= 1
        if not spot.get('foodGroups'):
            fg = loc.get('food_groups') or (row.get('food_groups') if single_loc else None)
            if isinstance(fg, list) and fg:
                spot['foodGroups'] = fg
        if not spot.get('foodCuisines'):
            fc = loc.get('food_cuisines') or (row.get('food_cuisines') if single_loc else None)
            if isinstance(fc, list) and fc:
                spot['foodCuisines'] = fc
        if not spot.get('precision'):
            prec = loc.get('precision')
            if isinstance(prec, str) and prec.strip():
                spot['precision'] = prec.strip()

        raw_status = str(loc.get('status') or '')
        raw_note = str(loc.get('status_note') or '').strip()
        nm = str(spot.get('name') or '')
        derived_status = None
        if raw_status == 'closed' or '已结业' in raw_note:
            derived_status = 'closed'
        elif '已结束营运' in raw_note or '已结束营运' in nm or '已迁出' in raw_note or '已迁出' in nm:
            derived_status = 'ended'
        elif any(k in raw_note or k in nm for k in ('暂停营业', '疑似闭店', '现况待核对', '现况有冲突')):
            derived_status = 'paused'
        if derived_status and spot.get('status') != 'seasonal':
            spot['status'] = derived_status
            if raw_note:
                spot['statusNote'] = raw_note[:140]
            elif '已迁出' in nm:
                spot['statusNote'] = '原店址已迁出，前往前请核实最新地址。'
            elif '现况' in nm:
                spot['statusNote'] = '原店址现况待核对，前往前请确认营业状态。'

        for k in stats:
            if spot.get(k):
                stats[k] += 1
    return stats


def main():
    existing = json.loads(OUT.read_text()) if OUT.exists() else []
    seen = {s['id'] for s in existing}
    added = []
    rows = []

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

    if CURATED_PHASE2.exists():
        for c in json.loads(CURATED_PHASE2.read_text()):
            sid = c['id']
            if sid in seen:
                continue
            seen.add(sid)
            added.append(c)

    all_spots = existing + added
    stats = enrich_spots_from_map_data(all_spots, rows) if rows else {}
    merged, removed_names = dedupe_spots(all_spots)
    if rows:
        stats = {
            k: sum(1 for s in merged if str(s.get('id', '')).startswith('xhs-') and s.get(k))
            for k in ('foodGroups', 'foodCuisines', 'precision', 'status')
        }
    OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    hk = sum(1 for s in merged if s['city'] == 'hk')
    sz = sum(1 for s in merged if s['city'] == 'sz')
    hk_new = sum(1 for s in added if s['city'] == 'hk')
    sz_new = sum(1 for s in added if s['city'] == 'sz')
    print(f'Added {len(added)} new XHS spots (+{hk_new} HK, +{sz_new} SZ), removed {len(removed_names)} duplicates. Total: {len(merged)} ({hk} HK, {sz} SZ) -> {OUT}')
    if removed_names:
        for rn in removed_names:
            print(f'  removed dup: {rn}')
    if stats:
        print(f'Enriched metadata counts across XHS spots: {stats}')


if __name__ == '__main__':
    main()
