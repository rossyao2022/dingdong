"""Pinned reference content; imports add dedicated versions without changing CA content."""

import json
from pathlib import Path


def reference_data():
    return json.loads(
        (Path(__file__).resolve().parents[1] / "content" / "prototype_reference.json").read_text()
    )


def questionnaire_payloads():
    data = reference_data()
    source = data["source_commit"]
    result = []
    for purpose in ["interest", "talent"]:
        items = (
            data["interest"]["islands"] if purpose == "interest" else data["talent"]["questions"]
        )
        prompts = (
            [
                (f"{island['id']}-{i}", island["id"], text)
                for island in items
                for i, text in enumerate(island["questions"])
            ]
            if purpose == "interest"
            else [(str(q["id"]), q["type"], q["text"]) for q in items]
        )
        labels = (
            {x["id"]: x["name"] for x in data["interest"]["islands"]}
            if purpose == "interest"
            else {x["id"]: x["name"] for x in data["talent"]["dimensions"]}
        )
        option_labels = (
            ["很不喜欢", "不太喜欢", "不确定", "有点喜欢", "非常喜欢"]
            if purpose == "interest"
            else data["talent"]["options"]
        )
        offset = 0 if purpose == "interest" else 1
        questions = [
            {
                "code": code,
                "type": "single_choice",
                "title": text,
                "required": True,
                "min_choices": 1,
                "max_choices": 1,
                "options": [
                    {"code": str(i + offset), "label": label}
                    for i, label in enumerate(option_labels)
                ],
            }
            for code, _, text in prompts
        ]
        result.append(
            {
                "code": f"prototype-{purpose}",
                "version": "v1",
                "purpose": purpose,
                "title": "六岛兴趣探索" if purpose == "interest" else "八维日常观察",
                "description": "看看孩子此刻想尝试什么，一起发现新的兴趣。"
                if purpose == "interest"
                else "从日常小事了解孩子，多给他们尝试和成长的机会。",
                "data_origin": "reference",
                "schema_version": "questionnaire-v1",
                "questions": questions,
                "scoring": {
                    "version": "interest-mean-v1" if purpose == "interest" else "talent-sum-v1",
                    "source_commit": source,
                    "groups": {code: group for code, group, _ in prompts},
                    "labels": labels,
                },
            }
        )
    return result


def activity_payloads():
    data = reference_data()
    details = {
        "R": (
            "纸桥挑战",
            "一张纸、两本书、几块橡皮",
            "折一折纸，试试哪种桥更能承重。",
            "把两本书并排摆好，留出小空隙。",
            "换三种折法搭纸桥，逐个放上橡皮。",
            "比较结果，再改一处重新试试。",
        ),
        "I": (
            "叶子小侦探",
            "两片落叶、纸和笔",
            "观察细节，用证据回答一个小问题。",
            "捡两片落叶，看看颜色、形状和叶脉。",
            "记录三个相同或不同的地方。",
            "提出一个为什么，和家人一起寻找线索。",
        ),
        "A": (
            "云朵新故事",
            "纸和画笔",
            "用图画和语言表达自己的想象。",
            "看看天空或想象一朵云，它像什么？",
            "画下它，编一个有转折的新故事。",
            "讲给家人听，再试一个不同的结尾。",
        ),
        "S": (
            "一起帮个忙",
            "家里需要完成的一件小事",
            "倾听别人的需要，一起完成一件事。",
            "问家人：今天有哪件事想请我帮忙？",
            "商量分工，一起做一件安全的小事。",
            "互相说说哪一步帮到了对方。",
        ),
        "E": (
            "家庭小舞台",
            "纸和笔、一个安全的展示空间",
            "提出想法，邀请伙伴一起行动。",
            "想一个三分钟的小节目，给它起个名字。",
            "邀请家人参与，分好角色并排练一次。",
            "表演后听听建议，选一条下次再试。",
        ),
        "C": (
            "桌面整理师",
            "桌面物品、几个盒子",
            "自己定分类规则，让物品容易找到。",
            "选一小块桌面，把物品摆开。",
            "按用途或大小分组，给每组安排位置。",
            "请家人找一件物品，看看规则是否好用。",
        ),
    }
    rows = []
    for island in data["interest"]["islands"]:
        title, materials, goal, *instructions = details[island["id"]]
        rows.append(
            {
                "code": island["task"],
                "version": "prototype-v1",
                "title": title,
                "island": island["id"],
                "mood": "focus",
                "duration_minutes": 10,
                "data_origin": "reference",
                "content": {
                    "materials": materials,
                    "goal": goal,
                    "alternative": island["try"],
                    "allowed_styles": ["cognitive", "emotional", "creative", "exploratory"],
                    "steps": [
                        {
                            "index": i,
                            "instruction": text,
                            "guide_text": "让孩子先说说自己的想法，再一起试一试。",
                        }
                        for i, text in enumerate(instructions)
                    ],
                },
            }
        )
    guide_tasks = {
        "whorl": ("prototype-paper-bridge", "R"),
        "loop": ("prototype-building", "S"),
        "reverse": ("prototype-story-route", "A"),
        "arch": ("prototype-two-plays", "A"),
    }
    for pattern, (code, island) in guide_tasks.items():
        guide = data["fingerprint_guides"][pattern]
        activity = guide["activity"]
        rows.append(
            {
                "code": code,
                "version": "prototype-v1",
                "title": activity["title"],
                "island": island,
                "mood": "focus",
                "duration_minutes": 10,
                "data_origin": "reference",
                "content": {
                    "materials": activity["materials"],
                    "goal": activity["observe"],
                    "alternative": "选择身边安全的材料，也可以只用语言想象。",
                    "allowed_styles": ["cognitive", "emotional", "creative", "exploratory"],
                    "steps": [
                        {"index": i, "instruction": text, "guide_text": guide["prompt"]}
                        for i, text in enumerate(activity["steps"])
                    ],
                },
            }
        )
    return rows
