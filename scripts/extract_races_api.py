#!/usr/bin/env python3
"""从PRTS Wiki批量提取干员种族信息"""
import json
import re
import urllib.request
import urllib.parse
import time
import sys

BASE_URL = "https://prts.wiki/api.php"
OUTPUT_FILE = "operator_races.json"

def api_get(params):
    """发送GET请求到PRTS API"""
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "ArknightsRaceExtractor/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get_all_operator_names():
    """获取所有干员名称列表"""
    names = []
    offset = 0
    while True:
        data = api_get({
            "action": "cargoquery",
            "format": "json",
            "limit": 500,
            "offset": offset,
            "tables": "chara",
            "fields": "chara.cn,chara.charId",
            "where": "chara.charIndex > 0",
            "order_by": "chara.charIndex"
        })
        results = data.get("cargoquery", [])
        if not results:
            break
        for item in results:
            title = item.get("title", {})
            cn = title.get("cn", "")
            char_id = title.get("charId", "")
            if cn:
                names.append({"cn": cn, "charId": char_id})
        offset += len(results)
        if len(results) < 500:
            break
    return names

def get_wikitext_batch(page_titles):
    """批量获取页面wikitext（最多50个）"""
    params = {
        "action": "query",
        "format": "json",
        "prop": "revisions",
        "rvprop": "content",
        "titles": "|".join(page_titles),
    }
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "ArknightsRaceExtractor/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results = {}
    pages = data.get("query", {}).get("pages", {})
    for page_id, page_data in pages.items():
        title = page_data.get("title", "")
        revisions = page_data.get("revisions", [])
        if revisions:
            content = revisions[0].get("*", "")
            results[title] = content
    return results

def extract_race_from_wikitext(wikitext):
    """从wikitext中提取种族信息"""
    # 方法1: 从人员档案set模板提取
    match = re.search(r'\|\s*种族\s*=\s*([^\n|]+)', wikitext)
    if match:
        return match.group(1).strip()
    # 方法2: 从基础档案文本提取
    match = re.search(r'【种族】(.+?)[\n\r]', wikitext)
    if match:
        return match.group(1).strip()
    return None

def main():
    print("=" * 50)
    print("PRTS 干员种族信息批量提取工具")
    print("=" * 50)

    # 1. 获取所有干员名称
    print("[1/3] 获取干员列表...")
    operators = get_all_operator_names()
    print(f"  共获取 {len(operators)} 名干员")

    # 2. 批量获取wikitext并提取种族
    print("[2/3] 批量提取种族信息...")
    race_map = {}
    no_race = []
    batch_size = 50
    total_batches = (len(operators) + batch_size - 1) // batch_size

    for i in range(0, len(operators), batch_size):
        batch = operators[i:i + batch_size]
        batch_num = i // batch_size + 1
        titles = [op["cn"] for op in batch]
        print(f"  批次 {batch_num}/{total_batches} ({len(titles)} 人)...", end=" ")
        sys.stdout.flush()

        try:
            wikitexts = get_wikitext_batch(titles)
            for op in batch:
                cn = op["cn"]
                char_id = op["charId"]
                wt = wikitexts.get(cn, "")
                race = extract_race_from_wikitext(wt)
                if race:
                    race_map[char_id] = {"cn": cn, "race": race}
                else:
                    no_race.append({"charId": char_id, "cn": cn})
            print("OK")
        except Exception as e:
            print(f"ERR: {e}")
            for op in batch:
                no_race.append({"charId": op["charId"], "cn": op["cn"]})

        # 避免请求过快
        if i + batch_size < len(operators):
            time.sleep(1)

    # 3. 统计与输出
    print("[3/3] 统计并保存...")
    race_stats = {}
    for char_id, info in race_map.items():
        race = info["race"]
        if race not in race_stats:
            race_stats[race] = []
        race_stats[race].append(info["cn"])

    output = {
        "total": len(race_map),
        "no_race_count": len(no_race),
        "race_count": len(race_stats),
        "race_stats": {r: len(ops) for r, ops in sorted(race_stats.items(), key=lambda x: -len(x[1]))},
        "operators": race_map,
        "no_race": no_race,
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 打印统计
    print(f"\n{'='*50}")
    print(f"  总计: {len(race_map)} 人有种族信息")
    print(f"  无种族: {len(no_race)} 人")
    print(f"  种族种类: {len(race_stats)} 种")
    print(f"{'='*50}")
    print(f"\n{'种族':<8} {'人数':>4}  代表干员")
    print(f"{'-'*8} {'-'*4}  {'-'*30}")
    for race, ops in sorted(race_stats.items(), key=lambda x: -len(x[1])):
        examples = ", ".join(ops[:4])
        if len(ops) > 4:
            examples += f" ... 共{len(ops)}人"
        print(f"{race:<8} {len(ops):>4}  {examples}")

    if no_race:
        print(f"\n[!] 无种族信息的干员 ({len(no_race)}人):")
        names = [op["cn"] for op in no_race]
        print(", ".join(names))

    print(f"\n[OK] 结果已保存到: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
