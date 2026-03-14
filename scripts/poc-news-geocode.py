"""
PoC v2: 中央社 RSS → Gemini 全流程（地名辨識 + 座標推理 + 摘要）→ GeoJSON
模型: gemini-3.1-flash-lite-preview
用法: python3 scripts/poc-news-geocode.py
"""

import json
import os
import sys
import time
from pathlib import Path

# 從專案根目錄 .env 載入環境變數
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

# ---------------------------------------------------------------------------
# 0. SSL workaround (macOS Python 常見問題)
# ---------------------------------------------------------------------------
import ssl
import certifi
import urllib.request

ssl_ctx = ssl.create_default_context(cafile=certifi.where())
opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl_ctx))
urllib.request.install_opener(opener)

# ---------------------------------------------------------------------------
# 1. RSS 抓取
# ---------------------------------------------------------------------------
try:
    import feedparser
except ImportError:
    sys.exit("請先安裝: pip3 install feedparser google-genai certifi")

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"

RSS_FEEDS = {
    "local":      "https://feeds.feedburner.com/rsscna/local",
    "social":     "https://feeds.feedburner.com/rsscna/social",
    "lifehealth": "https://feeds.feedburner.com/rsscna/lifehealth",
}


def fetch_rss(max_per_feed: int = 10) -> list[dict]:
    """抓取中央社 RSS，回傳新聞列表"""
    articles = []
    for category, url in RSS_FEEDS.items():
        print(f"  抓取 RSS: {category} ...")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            raw = urllib.request.urlopen(req, context=ssl_ctx).read()
            feed = feedparser.parse(raw)
        except Exception as e:
            print(f"    ⚠ 抓取失敗: {e}")
            continue
        for entry in feed.entries[:max_per_feed]:
            articles.append({
                "id": entry.get("id", entry.link),
                "title": entry.title,
                "summary": entry.get("summary", ""),
                "link": entry.link,
                "published": entry.get("published", ""),
                "category": category,
            })
    print(f"  共取得 {len(articles)} 篇新聞\n")
    return articles


# ---------------------------------------------------------------------------
# 2. Gemini 全流程：地名辨識 + 正規化 + 座標推理 + 摘要
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """你是台灣新聞地理分析專家。請分析以下新聞，完成三件事：

1. **地點辨識與正規化**：
   - 找出新聞中提到的所有台灣地點
   - 將簡稱正規化為完整行政區名（例如：金門→金門縣、台北→台北市、高雄→高雄市、宜蘭→宜蘭縣）
   - 辨識地標並推理其所在行政區（例如：台大→國立台灣大學，位於台北市大安區）

2. **座標推理**：
   - 為每個地點提供經緯度座標（lat, lng）
   - 你應該知道台灣所有縣市、鄉鎮市區的大致座標
   - 對於知名地標（大學、車站、機場、觀光景點等），請提供該地標的實際座標
   - 如果你不確定精確座標，請提供該地點所在行政區的中心座標，並將 confidence 降低

3. **新聞摘要**：
   - 產生一句話中文摘要（20字以內）
   - 判斷新聞分類

---

新聞內容：
{news_text}

---

請回傳 JSON（不要加 markdown code block）：
{{
  "locations": [
    {{
      "original": "新聞中的原始地名文字",
      "name": "正規化後的完整地名",
      "type": "city | district | address | landmark",
      "lat": 25.0330,
      "lng": 121.5654,
      "confidence": 0.95,
      "note": "（選填）座標來源說明，例如『台大校本部』"
    }}
  ],
  "primary_location": {{
    "name": "這則新聞最主要發生的地點",
    "lat": 25.0330,
    "lng": 121.5654
  }},
  "summary": "一句話中文摘要（20字以內）",
  "news_category": "社會 | 天災 | 交通 | 政治 | 生活 | 經濟 | 其他"
}}

規則：
- 只抽取台灣的地點，忽略國外地名
- 每則新聞必須有 primary_location（最重要的那個地點）
- 如果完全沒有台灣地點，locations 回傳空陣列，primary_location 為 null
- lat/lng 必須是數字，不可為 null（如果你不確定，給出最接近的行政區座標）
- confidence: 1.0=確定精確座標, 0.8=行政區中心, 0.5=推測"""


def analyze_news_gemini(articles: list[dict], client) -> list[dict]:
    """用 Gemini 一次完成地名辨識 + 座標推理 + 摘要"""
    results = []
    for i, article in enumerate(articles):
        news_text = f"標題: {article['title']}\n摘要: {article['summary']}"
        prompt = ANALYSIS_PROMPT.format(news_text=news_text)

        print(f"  [{i+1}/{len(articles)}] {article['title'][:40]}...")

        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                raw = raw.rsplit("```", 1)[0]
            parsed = json.loads(raw)

            article["locations"] = parsed.get("locations", [])
            article["primary_location"] = parsed.get("primary_location")
            article["ai_summary"] = parsed.get("summary", "")
            article["news_category"] = parsed.get("news_category", "其他")
        except Exception as e:
            print(f"    ⚠ Gemini 錯誤: {e}")
            article["locations"] = []
            article["primary_location"] = None
            article["ai_summary"] = ""
            article["news_category"] = "其他"

        results.append(article)
        time.sleep(0.3)

    located = sum(1 for a in results if a["locations"])
    print(f"\n  分析完成: {located}/{len(results)} 篇有地點資訊")

    # 統計座標覆蓋
    total_locs = sum(len(a.get("locations", [])) for a in results)
    with_coords = sum(
        1 for a in results
        for loc in a.get("locations", [])
        if loc.get("lat") is not None
    )
    print(f"  座標覆蓋: {with_coords}/{total_locs} 個地點有座標\n")
    return results


# ---------------------------------------------------------------------------
# 3. Search Grounding 補查（針對 primary_location 沒座標的新聞）
# ---------------------------------------------------------------------------
def search_missing_coords(articles: list[dict], client) -> list[dict]:
    """用 Google Search grounding 補查缺少座標的地點"""
    from google.genai import types

    missing = [
        a for a in articles
        if a.get("primary_location")
        and a["primary_location"].get("lat") is None
    ]

    if not missing:
        print("  所有主要地點都有座標，跳過 Search Grounding\n")
        return articles

    print(f"  有 {len(missing)} 則新聞的主要地點缺少座標，啟動 Search Grounding...")

    grounding_tool = types.Tool(google_search=types.GoogleSearch())
    config = types.GenerateContentConfig(tools=[grounding_tool])

    for article in missing:
        loc_name = article["primary_location"]["name"]
        prompt = f"「{loc_name}」在台灣的經緯度座標是多少？只回傳 JSON: {{\"lat\": 數字, \"lng\": 數字}}"

        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=config,
            )
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                raw = raw.rsplit("```", 1)[0]
            coords = json.loads(raw)
            if coords.get("lat") and coords.get("lng"):
                article["primary_location"]["lat"] = coords["lat"]
                article["primary_location"]["lng"] = coords["lng"]
                print(f"    ✓ {loc_name}: ({coords['lat']}, {coords['lng']})")
        except Exception as e:
            print(f"    ⚠ {loc_name}: Search 失敗 - {e}")

        time.sleep(0.5)

    print()
    return articles


# ---------------------------------------------------------------------------
# 4. 輸出 GeoJSON
# ---------------------------------------------------------------------------
def to_geojson(articles: list[dict]) -> dict:
    """轉為 GeoJSON FeatureCollection，以 primary_location 為主"""
    features = []
    for article in articles:
        primary = article.get("primary_location")

        # 優先用 primary_location
        if primary and primary.get("lat") is not None:
            features.append(_make_feature(article, primary, is_primary=True))

        # 其他地點也加入（但標記非主要）
        for loc in article.get("locations", []):
            if loc.get("lat") is None:
                continue
            # 跳過與 primary 重複的點
            if (primary
                and abs(loc.get("lat", 0) - primary.get("lat", 0)) < 0.001
                and abs(loc.get("lng", 0) - primary.get("lng", 0)) < 0.001):
                continue
            features.append(_make_feature(article, loc, is_primary=False))

    return {"type": "FeatureCollection", "features": features}


def _make_feature(article: dict, loc: dict, is_primary: bool) -> dict:
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [loc["lng"], loc["lat"]],
        },
        "properties": {
            "title": article["title"],
            "summary": article.get("ai_summary", ""),
            "category": article.get("news_category", "其他"),
            "rss_category": article["category"],
            "link": article["link"],
            "published": article["published"],
            "location_name": loc.get("name", loc.get("original", "")),
            "location_type": loc.get("type", ""),
            "confidence": loc.get("confidence", 0),
            "note": loc.get("note", ""),
            "is_primary": is_primary,
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("請設定環境變數 GEMINI_API_KEY（或加到 .env）")

    from google import genai
    client = genai.Client(api_key=api_key)

    print("=" * 60)
    print(f"PoC v2: RSS → Gemini 全流程分析 → GeoJSON")
    print(f"模型: {GEMINI_MODEL}")
    print("=" * 60)

    # Step 1: RSS
    print("\n[1/3] 抓取中央社 RSS...")
    articles = fetch_rss(max_per_feed=5)

    if not articles:
        sys.exit("沒有抓到任何新聞，請確認網路連線")

    # Step 2: Gemini 全流程分析
    print("[2/3] Gemini 分析（地名辨識 + 座標推理 + 摘要）...")
    articles = analyze_news_gemini(articles, client)

    # Step 2.5: Search Grounding 補查（選用）
    use_search = os.environ.get("USE_SEARCH_GROUNDING", "").lower() in ("1", "true", "yes")
    if use_search:
        print("[2.5] Search Grounding 補查缺少座標的地點...")
        articles = search_missing_coords(articles, client)
    else:
        print("  (跳過 Search Grounding，設定 USE_SEARCH_GROUNDING=1 可啟用)\n")

    # Step 3: 輸出
    print("[3/3] 輸出結果...")

    output_json = "scripts/poc-news-output.json"
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    print(f"  完整資料: {output_json}")

    geojson = to_geojson(articles)
    output_geojson = "scripts/poc-news-output.geojson"
    with open(output_geojson, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"  GeoJSON:  {output_geojson} ({len(geojson['features'])} 個點位)")

    # 摘要
    print("\n" + "=" * 60)
    print("結果摘要:")
    print(f"  新聞總數:     {len(articles)}")
    located = [a for a in articles if a.get("primary_location")]
    print(f"  有主要地點:   {len(located)}")
    print(f"  GeoJSON 點位: {len(geojson['features'])}")

    # 印出每篇新聞的主要地點
    print(f"\n{'─' * 60}")
    print("各篇新聞主要地點：")
    print(f"{'─' * 60}")
    for article in articles:
        p = article.get("primary_location")
        cat = article.get("news_category", "?")
        summary = article.get("ai_summary", "")
        if p and p.get("lat"):
            print(f"  📍 {p['name']} ({p['lat']:.4f}, {p['lng']:.4f})")
        elif p:
            print(f"  ❓ {p['name']} (座標未知)")
        else:
            print(f"  ⊘  無地點")
        print(f"     [{cat}] {summary}")
        print(f"     {article['title'][:55]}")

        # 顯示其他地點
        others = [
            loc for loc in article.get("locations", [])
            if p and loc.get("name") != p.get("name")
        ]
        if others:
            names = ", ".join(
                f"{loc['name']}({'✓' if loc.get('lat') else '?'})"
                for loc in others
            )
            print(f"     其他地點: {names}")
        print()


if __name__ == "__main__":
    main()
