#!/usr/bin/env python3
"""Fetch verified Hong Kong & Shenzhen supermarkets, malls, and hospitals from OpenStreetMap Overpass API and merge into public/data/xhs-spots.json."""

import json
import math
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPOTS_PATH = ROOT / "public" / "data" / "xhs-spots.json"
import time
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)


def in_city_bounds(lon: float, lat: float, city: str) -> bool:
    if city == "sz":
        return 113.75 < lon < 114.68 and 22.40 < lat < 22.86
    return 113.8 < lon < 114.45 and 22.15 < lat < 22.6


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = math.pi / 180
    dlat = (b[1] - a[1]) * r
    dlon = (b[0] - a[0]) * r
    h = math.sin(dlat / 2) ** 2 + math.cos(a[1] * r) * math.cos(b[1] * r) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def query_overpass(ql: str) -> list[dict]:
    data = urllib.parse.urlencode({"data": ql}).encode("utf-8")
    last_err: Exception | None = None
    for url in OVERPASS_URLS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(url, data=data, headers={"User-Agent": "hksz-life-poi-fetcher/1.0"})
                with urllib.request.urlopen(req, timeout=90) as resp:
                    return json.loads(resp.read().decode("utf-8")).get("elements", [])
            except Exception as exc:
                last_err = exc
                time.sleep(2 + attempt * 2)
    raise RuntimeError(f"Overpass query failed: {last_err}")


def pick_name(tags: dict) -> str:
    for k in ("name:zh-Hans", "name:zh", "name:zh-Hant", "name"):
        v = (tags.get(k) or "").strip()
        if v and re.search(r"[\u4e00-\u9fff]", v):
            return v
    return (tags.get("name") or tags.get("name:en") or "").strip()


def pick_city(lon: float, lat: float, tags: dict) -> str | None:
    addr = " ".join(str(tags.get(k) or "") for k in ("addr:city", "addr:full", "addr:district", "name", "name:zh"))
    sz_hints = ("深圳", "Shenzhen", "南山", "福田", "罗湖", "宝安", "龙岗", "龙华", "盐田", "坪山", "光明", "大鹏")
    hk_hints = ("香港", "Hong Kong", "九龍", "九龙", "新界", "中環", "中环", "灣仔", "湾仔", "銅鑼灣", "铜锣湾", "尖沙咀", "旺角", "沙田", "屯門", "屯门", "元朗", "大埔", "荃灣", "荃湾", "將軍澳", "将军澳")
    if any(h in addr for h in sz_hints) and in_city_bounds(lon, lat, "sz"):
        return "sz"
    if any(h in addr for h in hk_hints) and in_city_bounds(lon, lat, "hk"):
        return "hk"
    # Latitude split along Shenzhen River / Mirs Bay for border clarity
    if lat >= 22.525 and in_city_bounds(lon, lat, "sz"):
        return "sz"
    if lat < 22.525 and in_city_bounds(lon, lat, "hk"):
        return "hk"
    if in_city_bounds(lon, lat, "sz"):
        return "sz"
    if in_city_bounds(lon, lat, "hk"):
        return "hk"
    return None


def build_address(tags: dict, city: str) -> str:
    parts = [
        tags.get("addr:full"),
        tags.get("addr:district"),
        tags.get("addr:street"),
        tags.get("addr:housenumber"),
    ]
    joined = " ".join(p.strip() for p in parts if p and p.strip())
    if joined:
        return joined
    return "深圳市" if city == "sz" else "香港"


def elem_coords(el: dict) -> tuple[float, float] | None:
    if "lon" in el and "lat" in el:
        return (round(float(el["lon"]), 5), round(float(el["lat"]), 5))
    c = el.get("center")
    if c and "lon" in c and "lat" in c:
        return (round(float(c["lon"]), 5), round(float(c["lat"]), 5))
    return None


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


MAJOR_MALL_KEYWORDS = (
    # HK
    "海港城", "Harbour City", "時代廣場", "时代广场", "Times Square", "崇光", "SOGO",
    "太古廣場", "太古广场", "Pacific Place", "國際金融中心", "国际金融中心", "ifc",
    "K11", "朗豪坊", "Langham Place", "又一城", "Festival Walk", "新城市廣場", "新城市广场",
    "太古城中心", "Cityplaza", "東薈城", "东荟城", "Citygate", "圓方", "圆方", "ELEMENTS",
    "希慎廣場", "希慎广场", "Hysan", "apm", "德福廣場", "德福广场", "Telford",
    "沙田新城市", "形點", "形点", "YOHO", "屯門市廣場", "屯门市广场", "PopCorn",
    "AIRSIDE", "The Wai", "圍方", "围方", "置地廣場", "置地广场", "LANDMARK",
    # SZ
    "萬象城", "万象城", "MixC", "萬象天地", "万象天地", "海岸城", "Coastal City",
    "壹方城", "Uniwalk", "COCO Park", "卓悅中心", "卓悦中心", "One Avenue",
    "海上世界", "歡樂海岸", "欢乐海岸", "深業上城", "深业上城", "UpperHills",
    "萬象前海", "万象前海", "皇庭廣場", "皇庭广场", "領展中心城", "领展中心城",
    "金光華", "金光华", "益田假日", "花園城", "花园城", "前海壹方匯", "大運天地",
    "萬象食家", "万象食家", "卓悅匯", "卓悦汇", "寶能", "宝能", "KK MALL", "KK ONE",
    "龍華壹方天地", "壹方天地", "海雅繽紛城", "海雅缤纷城", "深圳灣萬象城", "深圳湾万象城",
)

MAJOR_SUPERMARKET_BRANDS = (
    # HK
    "city'super", "citysuper", "DON DON DONKI", "AEON", "永旺", "一田", "YATA",
    "TASTE", "Market Place", "ThreeSixty", "Fusion", "惠康", "Wellcome", "百佳", "PARKnSHOP",
    "U購", "U购", "759", "Marks & Spencer", "M&S Food", "Sainsbury", "UNY", "APITA",
    # SZ
    "山姆", "Sam's", "Costco", "開市客", "开市客", "盒馬", "盒马", "Olé", "Ole",
    "blt", "永輝", "永辉", "華潤萬家", "华润万家", "Vanguard", "天虹", "Rainbow",
    "沃爾瑪", "沃尔玛", "Walmart", "麥德龍", "麦德龙", "Metro", "七鮮", "七鲜",
)


def fetch_category(ql: str, category: str, max_per_city: int, min_dist_m: float, filter_fn) -> list[dict]:
    elements = query_overpass(ql)
    buckets: dict[str, list[dict]] = {"hk": [], "sz": []}
    seen_names: dict[str, set[str]] = {"hk": set(), "sz": set()}

    # Prefer elements with both Chinese name and richer tags (opening_hours/website/brand)
    def score(el: dict) -> tuple[int, int]:
        tags = el.get("tags", {})
        s = 0
        if tags.get("website") or tags.get("url"):
            s += 3
        if tags.get("opening_hours"):
            s += 2
        if tags.get("addr:street") or tags.get("addr:full"):
            s += 1
        if tags.get("emergency") == "yes" or tags.get("healthcare") == "hospital":
            s += 2
        return (s, len(tags))

    elements.sort(key=score, reverse=True)

    for el in elements:
        tags = el.get("tags", {})
        name = pick_name(tags)
        if not name:
            continue
        coords = elem_coords(el)
        if not coords:
            continue
        city = pick_city(coords[0], coords[1], tags)
        if not city:
            continue
        if not filter_fn(name, tags, city):
            continue

        norm = re.sub(r"[\s()（）·\-]+", "", name).lower()
        if norm in seen_names[city]:
            continue
        if any(haversine_m(coords, existing["coordinates"]) < min_dist_m for existing in buckets[city]):
            continue
        if len(buckets[city]) >= max_per_city:
            continue

        seen_names[city].add(norm)
        osm_type = el.get("type", "node")
        osm_id = el.get("id")
        osm_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
        website = (tags.get("website") or tags.get("url") or "").strip()
        if website and not website.startswith(("http://", "https://")):
            website = ""
        hours = (tags.get("opening_hours") or "").strip()
        addr = build_address(tags, city)
        brand = (tags.get("brand") or tags.get("operator") or "").strip()
        note_bits = []
        if brand and brand not in name:
            note_bits.append(f"运营/品牌：{brand}")
        if tags.get("emergency") == "yes":
            note_bits.append("设有急诊服务")
        snippet = "；".join(note_bits) if note_bits else f"{'深圳' if city == 'sz' else '香港'}{category}，坐标核自 OpenStreetMap。"

        spot = {
            "id": f"osm-{city}-{category}-{osm_type}-{osm_id}",
            "city": city,
            "name": name,
            "category": category,
            "coordinates": [coords[0], coords[1]],
            "address": addr,
            "source": "OpenStreetMap",
            "sourceUrl": osm_url,
            "noteId": f"osm-{osm_type}-{osm_id}",
            "noteTitle": f"{name} · {category}",
            "noteUrl": website or osm_url,
            "snippet": snippet,
        }
        if hours:
            spot["hours"] = hours
        buckets[city].append(spot)

    return buckets["hk"] + buckets["sz"]


def main() -> None:
    existing = json.loads(SPOTS_PATH.read_text("utf-8"))
    kept = [s for s in existing if s.get("category") not in ("超市", "商场", "医院")]
    existing_coords = [(s["city"], tuple(s["coordinates"])) for s in kept]

    # Combined bbox covering HK + SZ
    bbox = "(22.16,113.76,22.85,114.64)"

    print("Fetching hospitals from Overpass...")
    hospitals = fetch_category(
        f'[out:json][timeout:60];(node["amenity"="hospital"]{bbox};way["amenity"="hospital"]{bbox};relation["amenity"="hospital"]{bbox};);out center tags;',
        category="医院",
        max_per_city=30,
        min_dist_m=900,
        filter_fn=lambda name, tags, city: (
            ("醫院" in name or "医院" in name or "Hospital" in name)
            and not any(x in name for x in ("動物", "动物", "寵物", "宠物", "Vet", "Veterinary", "牙科", "Dental"))
        ),
    )
    print(f"  -> Hospitals: {len(hospitals)} (HK {sum(1 for x in hospitals if x['city']=='hk')}, SZ {sum(1 for x in hospitals if x['city']=='sz')})")

    print("Fetching malls from Overpass...")
    malls = fetch_category(
        f'[out:json][timeout:60];(node["shop"="mall"]{bbox};way["shop"="mall"]{bbox};relation["shop"="mall"]{bbox};);out center tags;',
        category="商场",
        max_per_city=35,
        min_dist_m=700,
        filter_fn=lambda name, tags, city: any(k.lower() in name.lower() for k in MAJOR_MALL_KEYWORDS) or bool(tags.get("website")),
    )
    print(f"  -> Malls: {len(malls)} (HK {sum(1 for x in malls if x['city']=='hk')}, SZ {sum(1 for x in malls if x['city']=='sz')})")

    print("Fetching supermarkets from Overpass...")
    supermarkets = fetch_category(
        f'[out:json][timeout:60];(node["shop"="supermarket"]{bbox};way["shop"="supermarket"]{bbox};);out center tags;',
        category="超市",
        max_per_city=40,
        min_dist_m=900,
        filter_fn=lambda name, tags, city: any(
            b.lower() in (name + " " + (tags.get("brand") or "")).lower()
            for b in MAJOR_SUPERMARKET_BRANDS
        ),
    )
    print(f"  -> Supermarkets: {len(supermarkets)} (HK {sum(1 for x in supermarkets if x['city']=='hk')}, SZ {sum(1 for x in supermarkets if x['city']=='sz')})")

    merged = kept + hospitals + malls + supermarkets
    SPOTS_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {SPOTS_PATH}: {len(kept)} existing + {len(hospitals)+len(malls)+len(supermarkets)} new = {len(merged)} total.")


if __name__ == "__main__":
    main()
