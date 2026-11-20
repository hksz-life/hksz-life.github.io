"""Geocode verifiable HK/SZ place_hints from unlocated XHS notes via OSM Nominatim and export remaining unlocated inspiration."""
import json
import os
import pathlib
import re
import subprocess
import time
import urllib.parse

R = pathlib.Path(__file__).resolve().parents[1]
XHS_DATA = pathlib.Path(os.environ.get('XHS_MAP_DATA') or (R.parent / 'xhs/outputs/map-data.json'))
CACHE_PATH = R / 'data/raw/xhs-geocode-cache.json'
SPOTS_PATH = R / 'public/data/xhs-spots.json'
UNLOCATED_PATH = R / 'public/data/xhs-unlocated.json'

GOOD_CATS = {'吃喝探店', '咖啡甜品', '机位与拍照', '户外自然', '旅行', '酒吧饮品', '艺术看展', '待分类'}
HK_KW = ('香港', '港岛', '港島', '九龙', '九龍', '新界', '中环', '中環', '尖沙咀', '旺角', '铜锣湾', '銅鑼灣', '湾仔', '灣仔', '西营盘', '西營盤', '长洲', '長洲', '西贡', '西貢', '大屿山', '大嶼山', '大围', '大圍', '沙田', '元朗', '深水埗', '荃湾', '荃灣', '富德楼', '破边洲', '海下湾', '牛尾洲', '香港仔')
SZ_KW = ('深圳', '福田', '罗湖', '羅湖', '南山', '宝安', '寶安', '龙华', '龍華', '龙岗', '龍崗', '盐田', '鹽田', '大鹏', '大鵬', '坪山', '光明', '蛇口', '华侨城', '華僑城')


def clean_hint_for_query(raw_hint: str, city: str) -> tuple[str, str, list[str]]:
    """Return (display_name, nominatim_query, verify_tokens)."""
    s = raw_hint.strip()
    s = re.sub(r'^(?:地址|地点|候选|位置)[：:]\s*', '', s)
    # Extract store name before colon if present
    parts = re.split(r'[：:]', s, maxsplit=1)
    name_part = re.sub(r'[（(].*?[)）]', '', parts[0]).strip()
    addr_part = parts[1].strip() if len(parts) > 1 else s
    # Remove noisy annotations
    for noise in ('待核', '候选', '不再追原帖分店', '非深圳目的地', '营业状态待核', '门牌待核', '门址待核', '分店待核', '分店待确认', '登船集合点'):
        if noise in raw_hint and len(parts) == 1 and not re.search(r'(路|街|道|村|花园|大厦|中心|广场|公园|湾|洲|码头|新村|山)', raw_hint):
            return '', '', []
    # Prefer specific street/building/park/estate token
    q = re.sub(r'[（(].*?[)）]', ' ', addr_part)
    q = re.sub(r'(?:[A-Za-z]?\d+[层楼栋座单元号號铺室\-–]+|[一二三四五六七八九十]+楼|\d+号铺|地下\w*|B\d+层|L\d+[\-\d]*|[A-Za-z]\d+座)', ' ', q)
    q = re.sub(r'\s+', ' ', q).strip()
    # Extract clean tokens >= 2 Chinese/Latin chars for verification
    m_loc = re.findall(r'[\u4e00-\u9fff]{2,8}(?:花园|新村|大厦|广场|中心|公园|万象城|万象天地|创意园|老街|码头|水库|海滨|体育公园|渔人码头|书局|大学|湾|洲|路|街|道|坊|村)', q)
    if not m_loc:
        m_loc = re.findall(r'[\u4e00-\u9fff]{3,10}|[A-Za-z]{4,}', q)
    if not m_loc:
        return '', '', []
    best_tok = max(m_loc, key=len)
    city_word = '香港' if city == 'hk' else '深圳'
    query = best_tok if city_word in best_tok else f'{best_tok} {city_word}'
    title = name_part if (name_part and len(name_part) >= 2 and name_part != addr_part) else best_tok
    return title, query, [best_tok]


def main():
    cache = json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}
    raw = json.loads(XHS_DATA.read_text())
    rows = raw if isinstance(raw, list) else raw.get('rows') or []

    existing_spots = json.loads(SPOTS_PATH.read_text())
    existing_ids = {s['id'] for s in existing_spots}
    existing_notes = {s['noteId'] for s in existing_spots}

    added = []
    unlocated = []

    for r in rows:
        if any(l.get('lat') and (l.get('lng') or l.get('lon')) for l in (r.get('locations') or [])):
            continue
        cat = r.get('category') or '待分类'
        if cat not in GOOD_CATS:
            continue
        txt = ' '.join(str(r.get(k) or '') for k in ('title', 'content', 'image_text', 'place_hints', 'place_hints_reviewed'))
        is_hk = any(k in txt for k in HK_KW)
        is_sz = any(k in txt for k in SZ_KW)
        if not (is_hk or is_sz):
            continue
        if '惠东' in txt or '惠州' in txt or '非深圳目的地' in txt:
            continue
        city = 'hk' if (is_hk and not is_sz) else 'sz'
        hints = r.get('place_hints_reviewed') or r.get('place_hints') or []

        matched_any = False
        for idx, h in enumerate(hints[:4]):
            title, query, tokens = clean_hint_for_query(str(h), city)
            if not query:
                continue
            cache_key = f'{city}:{query}'
            if cache_key not in cache:
                vb = '113.8,22.15,114.45,22.6' if city == 'hk' else '113.75,22.42,114.65,22.86'
                u = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
                    'q': query, 'format': 'jsonv2', 'limit': 3, 'viewbox': vb, 'bounded': 1, 'accept-language': 'zh-CN,en'
                })
                res = subprocess.run(['curl', '-fLsS', '--max-time', '15', '-A', 'HongKongWandering-XHS/0.1', u], capture_output=True, text=True)
                cache[cache_key] = json.loads(res.stdout) if res.returncode == 0 and res.stdout.strip() else []
                time.sleep(1.05)

            hits = cache[cache_key]
            best = None
            for cand in hits:
                dn = (cand.get('name') or '') + ' ' + (cand.get('display_name') or '')
                lon, lat = float(cand['lon']), float(cand['lat'])
                if city == 'hk' and not (113.8 < lon < 114.45 and 22.15 < lat < 22.6):
                    continue
                if city == 'sz' and not (113.75 < lon < 114.68 and 22.40 < lat < 22.86):
                    continue
                # Require exact token or core 2+ char stem match
                if any(tok[:3] in dn or tok in dn for tok in tokens):
                    best = cand
                    break
            if best:
                sid = f"xhs-{r['id']}-g{idx}"
                if sid not in existing_ids:
                    existing_ids.add(sid)
                    spot = {
                        'id': sid,
                        'city': city,
                        'name': title if len(title) <= 32 else title[:32],
                        'category': cat if cat != '待分类' else '吃喝探店',
                        'coordinates': [round(float(best['lon']), 6), round(float(best['lat']), 6)],
                        'address': str(h),
                        'source': '小红书线索 + OSM Nominatim 核对',
                        'sourceUrl': f"https://www.openstreetmap.org/{best['osm_type']}/{best['osm_id']}",
                        'noteId': str(r['id']),
                        'noteTitle': r.get('title') or '',
                        'noteUrl': r.get('url') or '',
                        'snippet': ' '.join(str(r.get('content') or '').split())[:200],
                    }
                    added.append(spot)
                    existing_spots.append(spot)
                    matched_any = True

        if not matched_any and str(r['id']) not in existing_notes:
            unlocated.append({
                'id': f"xhs-note-{r['id']}",
                'city': city,
                'title': r.get('title') or '未命名收藏',
                'category': cat,
                'noteUrl': r.get('url') or '',
                'hints': [str(x) for x in hints[:4]],
                'snippet': ' '.join(str(r.get('content') or '').split())[:180],
            })

    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + '\n')
    SPOTS_PATH.write_text(json.dumps(existing_spots, ensure_ascii=False, indent=2) + '\n')
    UNLOCATED_PATH.write_text(json.dumps(unlocated, ensure_ascii=False, indent=2) + '\n')
    print(f'Added {len(added)} newly geocoded XHS spots -> total {len(existing_spots)} spots ({sum(s["city"]=="hk" for s in existing_spots)} HK, {sum(s["city"]=="sz" for s in existing_spots)} SZ)')
    print(f'Exported {len(unlocated)} remaining unlocated HK/SZ notes -> {UNLOCATED_PATH}')


if __name__ == '__main__':
    main()
