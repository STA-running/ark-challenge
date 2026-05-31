#!/usr/bin/env python3
"""
明日方舟自限挑战规则器 — 干员数据构建器
=========================================
双模式运行：

  --mode=full   完整构建（~20次API请求）：从零爬取全部数据，适合开发者大版本更新后跑
  --mode=quick  快速更新（2~4次API请求）：只拉Cargo+增量WikiText+增量头像，适合用户点击"更新"按钮

用法：
  python build_operators.py                        # 默认 quick
  python build_operators.py --mode=full             # 完整构建
  python build_operators.py --input=old.json        # 基于旧文件快速更新
"""
import json
import urllib.request
import urllib.parse
import time
import sys
import re
import argparse
from pathlib import Path

BASE_URL = "https://prts.wiki/api.php"
OUTPUT_FILE = Path("../public/data/operators.json")

# ============================================================
# 工具函数
# ============================================================

def api_get(params):
    """发送GET请求到PRTS API"""
    url = BASE_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "ArknightsDataBuilder/2.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def rarity_to_number(rarity_raw) -> int:
    try:
        return int(str(rarity_raw)) + 1
    except (ValueError, TypeError):
        return -1

def safe_str(val) -> str | None:
    if val is None or val == "":
        return None
    return str(val).strip()

def fetch_avatar_urls(names):
    """批量获取干员头像URL（60px缩略图）。
    通过 PRTS MediaWiki API 查询 File:头像_xxx.png 的URL。
    返回 { name: 'https://media.prts.wiki/thumb/.../60px-...png', ... }"""
    if not names:
        return {}
    result = {}
    batch_size = 50
    total = len(names)
    batches = (total + batch_size - 1) // batch_size

    for i in range(0, total, batch_size):
        batch = names[i:i + batch_size]
        batch_num = i // batch_size + 1
        print(f"  头像 批次 {batch_num}/{batches} ({len(batch)} 人)...", end=" ")
        sys.stdout.flush()

        file_titles = "|".join(f"File:头像_{name}.png" for name in batch)
        params = {
            "action": "query",
            "format": "json",
            "titles": file_titles,
            "prop": "imageinfo",
            "iiprop": "url",
        }
        try:
            url = BASE_URL + "?" + urllib.parse.urlencode(params)
            req = urllib.request.Request(url, headers={"User-Agent": "ArknightsDataBuilder/2.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            for page_id, pg in pages.items():
                title = pg.get("title", "")
                # title 格式 "文件:头像 W.png"（中文"文件:"前缀，空格分隔）
                # 提取干员名：去掉"文件:头像"前缀和".png"后缀
                op_name = title
                for prefix in ["文件:头像_", "文件:头像 ", "File:头像_", "File:头像 "]:
                    if op_name.startswith(prefix):
                        op_name = op_name[len(prefix):]
                        break
                if op_name.endswith(".png"):
                    op_name = op_name[:-4]
                imageinfo = pg.get("imageinfo", [])
                if imageinfo:
                    full_url = imageinfo[0].get("url", "")
                    # 构造60px缩略图URL
                    # full_url: https://media.prts.wiki/d/d6/头像_W.png
                    # thumb:    https://media.prts.wiki/thumb/d/d6/头像_W.png/60px-头像_W.png
                    if full_url:
                        # 取出 hash 前缀之后的部分
                        # URL结构: https://media.prts.wiki/{hash}/{filename}
                        parts = full_url.rsplit("/", 1)
                        hash_part = full_url.replace("https://media.prts.wiki/", "").rsplit("/", 1)[0]
                        filename = parts[1] if len(parts) > 1 else ""
                        thumb_url = f"https://media.prts.wiki/thumb/{hash_part}/{filename}/60px-{filename}"
                        result[op_name] = thumb_url
            print("OK")
        except Exception as e:
            print(f"ERR: {e}")

        if i + batch_size < total:
            time.sleep(0.5)

    return result

def fetch_cargo_all():
    """从Cargo API获取全部干员基础信息（含阵营）。
    返回 { charId: {...}, ... } 和 charId 列表"""
    cargo_map = {}
    offset = 0
    page = 1
    while True:
        print(f"  Cargo 第{page}页 (offset={offset})...", end=" ")
        data = api_get({
            "action": "cargoquery",
            "format": "json",
            "limit": 500,
            "offset": offset,
            "tables": "chara",
            "fields": (
                "chara.charId,chara.cn,chara.profession,chara.position,"
                "chara.rarity,chara.subProfession,chara.nation,chara.team,"
                "chara.tag,chara.charIndex"
            ),
            "where": "chara.charIndex > 0",
            "order_by": "chara.charIndex"
        })
        results = data.get("cargoquery", [])
        if not results:
            print("无更多数据")
            break
        count = 0
        for item in results:
            t = item.get("title", {})
            cid = t.get("charId", "")
            if cid:
                cargo_map[cid] = t
                count += 1
        print(f"OK ({count} 人)")
        offset += len(results)
        page += 1
        if len(results) < 500:
            break
        time.sleep(0.5)
    return cargo_map

def fetch_wikitext_for_names(names):
    """批量获取WikiText，提取种族+阻挡数。
    返回 { name: { race, block }, ... }"""
    if not names:
        return {}
    wiki_map = {}
    batch_size = 50
    total = len(names)
    batches = (total + batch_size - 1) // batch_size

    for i in range(0, total, batch_size):
        batch = names[i:i + batch_size]
        batch_num = i // batch_size + 1
        print(f"  WikiText 批次 {batch_num}/{batches} ({len(batch)} 人)...", end=" ")
        sys.stdout.flush()

        params = {
            "action": "query",
            "format": "json",
            "prop": "revisions",
            "rvprop": "content",
            "titles": "|".join(batch),
        }
        url = BASE_URL + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "ArknightsDataBuilder/2.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            pages = data.get("query", {}).get("pages", {})
            for page_id, pg in pages.items():
                title = pg.get("title", "")
                revisions = pg.get("revisions", [])
                if revisions:
                    content = revisions[0].get("*", "")
                    race = None
                    m_race = re.search(r'\|\s*种族\s*=\s*([^\n|]+)', content)
                    if m_race:
                        race = m_race.group(1).strip()
                    block = None
                    m_block = re.search(r'\|\s*阻挡数\s*=\s*(\d+)', content)
                    if m_block:
                        block = int(m_block.group(1))
                    wiki_map[title] = {"race": race, "block": block}
            print("OK")
        except Exception as e:
            print(f"ERR: {e}")

        if i + batch_size < total:
            time.sleep(1)

    return wiki_map

def build_operator_entry(cargo_raw, race, block, avatar):
    """将Cargo原始数据和WikiText数据合并为一条干员记录"""
    return {
        "name": cargo_raw.get("cn", ""),
        "profession": cargo_raw.get("profession", ""),
        "subProfession": cargo_raw.get("subProfession", ""),
        "rarity": rarity_to_number(cargo_raw.get("rarity", "")),
        "position": cargo_raw.get("position", ""),
        "tags": [t.strip() for t in cargo_raw.get("tag", "").split() if t.strip()] or None,
        "nation": safe_str(cargo_raw.get("nation")),
        "org": safe_str(cargo_raw.get("team")),
        "race": race,
        "block": block,
        "avatar": avatar,          # 🆕 头像URL（60px缩略图，外链PRTS）
        "charIndex": int(cargo_raw.get("charIndex", "0")) if cargo_raw.get("charIndex", "").isdigit() else -1,
    }

# ============================================================
# 模式一：完整构建（full）
# ============================================================

def full_build():
    """从零完整构建，~20次API请求"""
    print("=" * 50)
    print("完整构建模式 (full)")
    print("~20次API请求：Cargo 2次 + WikiText 9次 + 头像 9次")
    print("=" * 50)

    # 1. Cargo
    print("\n[1/3] 从Cargo API获取全部干员数据...")
    cargo_map = fetch_cargo_all()
    all_names = [c["cn"] for c in cargo_map.values()]
    print(f"  Cargo: {len(cargo_map)} 人")

    # 2. WikiText
    print("\n[2/3] 批量提取WikiText（种族+阻挡数）...")
    wiki_map = fetch_wikitext_for_names(all_names)
    race_count = sum(1 for v in wiki_map.values() if v.get("race"))
    block_count = sum(1 for v in wiki_map.values() if v.get("block") is not None)
    print(f"  有种族 {race_count}，有阻挡 {block_count}")

    # 3. 头像
    print("\n[3/3] 批量获取头像URL...")
    avatar_map = fetch_avatar_urls(all_names)
    print(f"  有头像 {len(avatar_map)} 人")

    # 合并
    operators = {}
    for cid, cargo in cargo_map.items():
        cn = cargo.get("cn", "")
        wiki = wiki_map.get(cn, {})
        operators[cid] = build_operator_entry(
            cargo,
            wiki.get("race"),
            wiki.get("block"),
            avatar_map.get(cn)
        )

    print(f"  合并完成：{len(operators)} 人")
    return operators

# ============================================================
# 模式二：快速更新（quick）
# ============================================================

def quick_build(input_file):
    """基于旧数据快速更新，2~4次API请求"""
    print("=" * 50)
    print("快速更新模式 (quick)")
    print("2~4次API请求：Cargo 2次 + (增量新干员 WikiText) + (增量新干员头像)")
    print("=" * 50)

    # 1. 读取旧数据
    print(f"\n[加载] 读取旧数据: {input_file}")
    with open(input_file, 'r', encoding='utf-8') as f:
        old_data = json.load(f)
    old_ops = old_data.get("operators", {})
    old_ids = set(old_ops.keys())
    print(f"  旧干员: {len(old_ids)} 人")

    # 2. 从Cargo拉最新
    print("\n[1/3] 从Cargo API获取最新干员列表...")
    cargo_map = fetch_cargo_all()
    new_ids = set(cargo_map.keys())
    print(f"  新干员: {len(new_ids)} 人")

    # 3. 找出差异
    added_ids = new_ids - old_ids   # 新增干员
    removed_ids = old_ids - new_ids  # 已移除干员
    common_ids = old_ids & new_ids   # 保持不变的老干员
    print(f"\n  差异分析：新增 {len(added_ids)} 人，移除 {len(removed_ids)} 人，不变 {len(common_ids)} 人")

    # 4. 新干员需要爬WikiText + 头像
    wiki_map = {}
    avatar_map = {}
    if added_ids:
        added_operators = [cargo_map[cid] for cid in added_ids]
        added_names = [o["cn"] for o in added_operators]
        print(f"\n[2/3] 新干员需要爬取WikiText + 头像...")
        wiki_map = fetch_wikitext_for_names(added_names)
        avatar_map = fetch_avatar_urls(added_names)
        print(f"  新干员WikiText: {len(wiki_map)} 人")
        print(f"  新干员头像: {len(avatar_map)} 人")

    # 5. 合并
    print("\n[3/3] 合并数据...")
    updated_ops = {}

    for cid in common_ids:
        # 老干员：保留 race/block/avatar，覆盖 nation/org
        old = old_ops[cid]
        fresh = cargo_map[cid]
        old["nation"] = safe_str(fresh.get("nation"))
        old["org"] = safe_str(fresh.get("team"))
        updated_ops[cid] = old

    for cid in added_ids:
        # 新干员：全部数据
        cargo = cargo_map[cid]
        cn = cargo["cn"]
        wiki = wiki_map.get(cn, {})
        updated_ops[cid] = build_operator_entry(
            cargo,
            wiki.get("race"),
            wiki.get("block"),
            avatar_map.get(cn)
        )

    # 被移除的干员：看用户想保留还是丢弃，这里选择保留但标记
    for cid in removed_ids:
        old = old_ops[cid]
        old["nation"] = None
        old["org"] = None
        old["_removed"] = True
        updated_ops[cid] = old
        print(f"  [注意] {old['name']} 可能已被PRTS移除，数据保留但标记 _removed=true")

    race_count = sum(1 for o in updated_ops.values() if o["race"])
    block_count = sum(1 for o in updated_ops.values() if o.get("block") is not None)
    print(f"  合并完成：{len(updated_ops)} 人，有种族 {race_count}，有阻挡 {block_count}")
    return updated_ops

# ============================================================
# 输出与统计
# ============================================================

def build_stats(operators):
    """生成统计信息"""
    stats = {
        "total": len(operators),
        "withNation": 0, "withOrg": 0, "withRace": 0,
        "noNation": 0, "noOrg": 0, "noRace": 0,
        "blockByCount": {"zero": 0, "one": 0, "two": 0, "threePlus": 0, "null": 0},
    }
    for op in operators.values():
        if op.get("nation"): stats["withNation"] += 1
        else: stats["noNation"] += 1
        if op.get("org"): stats["withOrg"] += 1
        else: stats["noOrg"] += 1
        if op.get("race"): stats["withRace"] += 1
        else: stats["noRace"] += 1
        b = op.get("block")
        if b is None: stats["blockByCount"]["null"] += 1
        elif b == 0: stats["blockByCount"]["zero"] += 1
        elif b == 1: stats["blockByCount"]["one"] += 1
        elif b == 2: stats["blockByCount"]["two"] += 1
        elif b >= 3: stats["blockByCount"]["threePlus"] += 1
    return stats

def print_stats(stats):
    print(f"\n{'='*50}")
    print(f"干员数据构建完成")
    print(f"{'='*50}")
    print(f"  总计:               {stats['total']} 人")
    print(f"  有国家/地区:        {stats['withNation']} 人 ({stats['withNation']/stats['total']*100:.1f}%)")
    print(f"  有组织:             {stats['withOrg']} 人 ({stats['withOrg']/stats['total']*100:.1f}%)")
    print(f"  有种族:             {stats['withRace']} 人 ({stats['withRace']/stats['total']*100:.1f}%)")
    print(f"\n  --- 阻挡数 ---")
    print(f"  0 阻挡:             {stats['blockByCount']['zero']} 人")
    print(f"  1 阻挡:             {stats['blockByCount']['one']} 人")
    print(f"  2 阻挡:             {stats['blockByCount']['two']} 人")
    print(f"  3+ 阻挡:            {stats['blockByCount']['threePlus']} 人")
    print(f"  无数据:             {stats['blockByCount']['null']} 人")

def write_output(operators, stats, version_note=""):
    output = {
        "version": "3.3",
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%S+08:00"),
        "note": version_note,
        "total": stats["total"],
        "operators": operators,
        "stats": stats,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    file_size = OUTPUT_FILE.stat().st_size / 1024
    print(f"\n  ✅ 输出: {OUTPUT_FILE} ({file_size:.0f} KB)")

# ============================================================
# 主入口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="干员数据构建器")
    parser.add_argument("--mode", choices=["full", "quick"], default="quick",
                        help="full=完整构建(11次) quick=快速更新(2~3次)")
    parser.add_argument("--input", default=None,
                        help="旧数据JSON路径（quick模式使用，默认自动找 OUTPUT_FILE）")
    args = parser.parse_args()

    if args.mode == "full":
        operators = full_build()
        stats = build_stats(operators)
        print_stats(stats)
        write_output(operators, stats, "完整构建")
    else:
        # quick 模式：找旧数据
        input_path = args.input or str(OUTPUT_FILE)
        if not Path(input_path).exists():
            print(f"⚠️  未找到旧数据文件: {input_path}")
            print("  首次构建请使用 --mode=full 完整构建")
            sys.exit(1)
        operators = quick_build(input_path)
        stats = build_stats(operators)
        print_stats(stats)
        write_output(operators, stats, "快速更新（仅增量爬取）")

if __name__ == "__main__":
    main()
