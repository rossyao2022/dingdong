/* Original 24 prompts and scoring, with observation-based explanations. */
window.TalentData = {
  "version": "talent-original-24-v1",
  "questions": [
    {
      "id": 1,
      "type": "word",
      "text": "在背诵诗歌或有韵律的句子时，表现得很出色。"
    },
    {
      "id": 2,
      "type": "word",
      "text": "如果别人用词错误，能敏锐地察觉并指出来。"
    },
    {
      "id": 3,
      "type": "word",
      "text": "善于用生动的语言讲故事，描绘听到的声音和画面。"
    },
    {
      "id": 4,
      "type": "music",
      "text": "唱歌时音准很好，不容易跑调。"
    },
    {
      "id": 5,
      "type": "music",
      "text": "喜欢听各种乐器，并能分辨出它们发出的声音。"
    },
    {
      "id": 6,
      "type": "music",
      "text": "能准确记住电视里经常播放的歌曲旋律。"
    },
    {
      "id": 7,
      "type": "logic",
      "text": "经常问“为什么”，喜欢探究事物背后的原因。"
    },
    {
      "id": 8,
      "type": "logic",
      "text": "经常询问关于自然现象（如打雷、下雨）的原理。"
    },
    {
      "id": 9,
      "type": "logic",
      "text": "善于将杂乱的玩具或物品按规律进行分类。"
    },
    {
      "id": 10,
      "type": "space",
      "text": "走过一遍的地方很少迷路，方向感很好。"
    },
    {
      "id": 11,
      "type": "space",
      "text": "外出旅行能记住沿途的标志性建筑。"
    },
    {
      "id": 12,
      "type": "space",
      "text": "喜欢画画，能形象逼真地勾勒出物体。"
    },
    {
      "id": 13,
      "type": "body",
      "text": "走路姿势协调，随音乐做的动作很优美。"
    },
    {
      "id": 14,
      "type": "body",
      "text": "动手能力强，比如很早就会系鞋带、骑车。"
    },
    {
      "id": 15,
      "type": "body",
      "text": "喜欢模仿戏剧人物的动作和表情。"
    },
    {
      "id": 16,
      "type": "self",
      "text": "喜欢独自一人玩耍，能够长时间专注做一件事。"
    },
    {
      "id": 17,
      "type": "self",
      "text": "善于表达自己的情绪，清楚自己为什么生气或开心。"
    },
    {
      "id": 18,
      "type": "self",
      "text": "对能不能完成某件事，自己心里有准确的判断。"
    },
    {
      "id": 19,
      "type": "social",
      "text": "善于察言观色，能注意到父母或朋友的情绪变化。"
    },
    {
      "id": 20,
      "type": "social",
      "text": "看见陌生人时，会联想到“他好像某某人”。"
    },
    {
      "id": 21,
      "type": "social",
      "text": "喜欢参与群体游戏，并在其中扮演特定角色。"
    },
    {
      "id": 22,
      "type": "nature",
      "text": "喜欢户外活动，对地上的蚂蚁、树叶、石头很感兴趣。"
    },
    {
      "id": 23,
      "type": "nature",
      "text": "喜欢去动物园、植物园，能分辨不同种类的动植物。"
    },
    {
      "id": 24,
      "type": "nature",
      "text": "对天气的变化很敏感，喜欢观察云朵、星星或季节更替。"
    }
  ],
  "dimensions": [
    {
      "id": "word",
      "name": "语言智能",
      "nickname": "文字故事家",
      "icon": "📝",
      "color": "#d96948",
      "desc": "关注语言、阅读、叙事和表达。",
      "careers": "作家、记者、主持人、翻译",
      "activity": "选一张照片，编一个有开头、转折、结尾的三分钟故事。",
      "when": "今天",
      "steps": "把故事讲给 DingDong 或家人听，再换一个结尾。",
      "reflection": "能否说明人物为什么这样做？最想用哪个词？"
    },
    {
      "id": "music",
      "name": "音乐智能",
      "nickname": "节奏收藏家",
      "icon": "🎵",
      "color": "#ac65b3",
      "desc": "关注音高、旋律、节奏和声音辨别。",
      "careers": "作曲家、音乐制作人、歌手、调音师",
      "activity": "用拍手和敲桌面的声音，创作一段四拍节奏。",
      "when": "今天",
      "steps": "请家人跟着拍，再交换创作一段新的节奏。",
      "reflection": "哪种声音最好辨认？愿不愿意再重复一次？"
    },
    {
      "id": "logic",
      "name": "逻辑数学",
      "nickname": "问题侦探",
      "icon": "🔢",
      "color": "#508ab8",
      "desc": "关注原因、分类、推理和规律。",
      "careers": "科学家、工程师、会计师、程序员",
      "activity": "用两张纸搭两种纸桥，先猜测，再比较哪种更稳。",
      "when": "今天",
      "steps": "只改变纸的折法，用相同的小橡皮测试并记录。",
      "reflection": "你的猜想和结果相同吗？下次想改变哪个条件？"
    },
    {
      "id": "space",
      "name": "空间智能",
      "nickname": "空间造梦师",
      "icon": "🎨",
      "color": "#8e74bf",
      "desc": "关注图像、方向、形状和空间想象。",
      "careers": "建筑师、摄影师、画家、设计师",
      "activity": "画出从房门到书桌的路线图，标出三个地标。",
      "when": "今天",
      "steps": "让家人按你的地图走，再加上遗漏的转弯。",
      "reflection": "哪里需要加一个标记，别人才能看懂？"
    },
    {
      "id": "body",
      "name": "身体动觉",
      "nickname": "行动创造家",
      "icon": "⚽",
      "color": "#cf9250",
      "desc": "关注动作协调、动手操作和身体表达。",
      "careers": "运动员、舞蹈家、工匠、演员",
      "activity": "在安全空地设计三个连续动作，表达一种天气。",
      "when": "今天",
      "steps": "慢慢演一遍，请家人猜，再一起改变动作。",
      "reflection": "哪个动作最容易表达？身体感觉舒服吗？"
    },
    {
      "id": "self",
      "name": "内省智能",
      "nickname": "心情观察家",
      "icon": "🧘",
      "color": "#6b98a3",
      "desc": "关注自我感受、独立思考和目标觉察。",
      "careers": "独立研究者、哲学研究者、心理咨询师",
      "activity": "画一张今天的心情天气图，写或说一个原因。",
      "when": "今天",
      "steps": "给明天设一个自己愿意做的小目标，可不公开。",
      "reflection": "什么事情让你开心？需要怎样的帮助？"
    },
    {
      "id": "social",
      "name": "人际智能",
      "nickname": "友谊联结家",
      "icon": "🤝",
      "color": "#c7768b",
      "desc": "关注倾听、理解他人和共同参与。",
      "careers": "教师、社会工作者、公关、外交官",
      "activity": "问家人一件今天想得到帮助的小事，一起分工。",
      "when": "今天",
      "steps": "先复述对方的需要，再商量谁做哪一步。",
      "reflection": "你听到了什么需要？合作时有哪些新发现？"
    },
    {
      "id": "nature",
      "name": "自然观察",
      "nickname": "自然发现家",
      "icon": "🌿",
      "color": "#649978",
      "desc": "关注动植物、环境细节和自然变化。",
      "careers": "生物学家、地质学家、园艺师、环保工作者",
      "activity": "在同一个安全地点观察三片不同的叶子。",
      "when": "今天",
      "steps": "不采摘也能观察，用画图记录边缘、颜色和纹理。",
      "reflection": "它们哪里一样、哪里不同？过几天会有变化吗？"
    }
  ],
  "options": [
    "完全不符合",
    "不太符合",
    "一般",
    "比较符合",
    "完全符合"
  ],
  "source": "capage/test.html + capage/result.html"
};
