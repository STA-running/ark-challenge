#!/usr/bin/env python3
"""从明日方舟游戏数据中提取干员种族信息"""
import json
import re
import urllib.request
from pathlib import Path

# 下载 handbook_info_table.json
HANDBOOK_URL = "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/handbook_info_table.json"
CHARACTER_URL = "https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/zh_CN/gamedata/excel/character_table.json"

OUTPUT_DIR = Path(__file__).parent
HANDBOOK_FILE = OUTPUT_DIR / "handbook_info_table.json"
CHARACTER_FILE = OUTPUT_DIR / "character_table.json"
OUTPUT_FILE = OUTPUT_DIR / "operator_races.json"

def download_if_needed(url: str, filepath: Path):
    """如果文件不存在则下载"""
    if filepath.exists():
        print(f"[OK] 已存在: {filepath.name}")
        return
    print(f"[DL] 下载: {filepath.name} ...")
    urllib.request.urlretrieve(url, filepath)
    print(f"[OK] 下载完成: {filepath.name}")

def extract_race_from_text(text: str) -> str | None:
    """从基础档案文本中提取种族"""
    match = re.search(r'【种族】(.+?)[\n\r]', text)
    if match:
        return match.group(1).strip()
    return None

def main():
    # 1. 下载所需文件
    download_if_needed(HANDBOOK_URL, HANDBOOK_FILE)
    download_if_needed(CHARACTER_URL, CHARACTER_FILE)

    # 2. 加载数据
    print("加载数据...")
    with open(HANDBOOK_FILE, 'r', encoding='utf-8') as f:
        handbook_data = json.load(f)
    with open(CHARACTER_FILE, 'r', encoding='utf-8') as f:
        character_data = json.load(f)

    # 3. 从 handbook_info_table.json 提取种族
    handbook_dict = handbook_data.get("handbookDict", {})
    race_map = {}  # charId -> race
    no_race = []   # 没找到种族的干员

    for char_id, info in handbook_dict.items():
        race = None
        story_audio = info.get("storyTextAudio", [])
        for audio_group in story_audio:
            stories = audio_group.get("stories", [])
            for story in stories:
                story_text = story.get("storyText", "")
                if "【种族】" in story_text:
                    race = extract_race_from_text(story_text)
                    if race:
                        break
            if race:
                break
        if race:
            race_map[char_id] = race
        else:
            no_race.append(char_id)

    # 4. 关联角色名和稀有度
    result = {}
    for char_id, race in race_map.items():
        char_info = character_data.get(char_id, {})
        name = char_info.get("name", "未知")
        rarity_raw = char_info.get("rarity", "")
        # TIER_5 => 6星, TIER_0 => 1星
        rarity_num = int(rarity_raw.replace("TIER_", "")) + 1 if rarity_raw.startswith("TIER_") else -1
        profession = char_info.get("profession", "")
        position = char_info.get("position", "")
        nation_id = char_info.get("nationId", "")
        group_id = char_info.get("groupId", "")
        team_id = char_info.get("teamId", "")

        result[char_id] = {
            "name": name,
            "race": race,
            "rarity": rarity_num,
            "profession": profession,
            "position": position,
            "nationId": nation_id or None,
            "groupId": group_id or None,
            "teamId": team_id or None,
        }

    # 5. 按种族统计
    race_stats = {}
    for char_id, info in result.items():
        race = info["race"]
        if race not in race_stats:
            race_stats[race] = []
        race_stats[race].append(info["name"])

    # 6. 输出结果
    output = {
        "total_operators": len(race_map),
        "no_race_count": len(no_race),
        "race_count": len(race_stats),
        "race_stats": {race: len(ops) for race, ops in sorted(race_stats.items(), key=lambda x: -len(x[1]))},
        "operators": result,
        "no_race_ids": no_race,
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 7. 打印统计
    print(f"\n{'='*60}")
    print(f"干员种族统计")
    print(f"{'='*60}")
    print(f"总计干员: {len(race_map)} 人（有种族信息）")
    print(f"无种族信息: {len(no_race)} 人")
    print(f"种族种类: {len(race_stats)} 种\n")

    print(f"{'种族':<10} {'人数':>4}  代表干员")
    print(f"{'-'*10} {'-'*4}  {'-'*30}")
    for race, ops in sorted(race_stats.items(), key=lambda x: -len(x[1])):
        examples = "、".join(ops[:5])
        if len(ops) > 5:
            examples += f" 等{len(ops)}人"
        print(f"{race:<10} {len(ops):>4}  {examples}")

    if no_race:
        print(f"\n[WARN] 无种族信息的干员 ({len(no_race)}人):")
        no_race_names = []
        for cid in no_race:
            char_info = character_data.get(cid, {})
            no_race_names.append(char_info.get("name", cid))
        print("、".join(no_race_names))

    print(f"\n[OK] 结果已保存到: {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
