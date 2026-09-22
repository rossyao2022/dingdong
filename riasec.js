/* Original child-friendly exploration prompts using the six RIASEC categories.
 * Not a translation, shortened form, or scoring implementation of the O*NET instrument. */
(() => {
  'use strict';
  const islands = [
    {id:'R',name:'自然原始岛',type:'实用型',en:'REALISTIC',verb:'动手创造',color:'#518969',soft:'#e3f2df',desc:'种花、搭建、修理小物件。在这里，用双手把想法变成看得见的东西。',meaning:'对工具、材料、自然和实际操作感兴趣，喜欢亲手试一试。',questions:['用纸板和积木，搭一个能站稳的小房子。','照顾一盆植物，亲手浇水、换土并观察它长大。','和大人一起研究一个小物件的零件，试着把它装好。'],try:'给一张纸换三种折法，试试哪一种能托住更多橡皮。',fields:'工程制作、园艺、手工与技术实践',task:'paper-bridge'},
    {id:'I',name:'深思冥想岛',type:'研究型',en:'INVESTIGATIVE',verb:'追问为什么',color:'#557eb0',soft:'#e4effa',desc:'观察星星，做做实验，追问为什么。每一个问号，都可以是一段新旅程。',meaning:'对发现原因、比较证据和理解规律感兴趣，愿意花时间研究问题。',questions:['猜猜冰块放在哪里融化得更快，再做一次小实验。','观察几片叶子，找出它们相同和不同的地方。','为一个“为什么”查找线索，再向家人讲讲你的发现。'],try:'选两片叶子，记录三个差异，再提出一个还想知道的问题。',fields:'科学研究、数据观察与问题分析',task:'leaf-look'},
    {id:'A',name:'美丽浪漫岛',type:'艺术型',en:'ARTISTIC',verb:'自由表达',color:'#a26b9e',soft:'#f3e5f3',desc:'画一幅画，编一个故事，给生活配上音乐。你的想象，在这里有自己的颜色。',meaning:'对创作、审美和表达感兴趣，喜欢尝试不同的呈现方式。',questions:['给一朵云编一个从来没有人讲过的故事。','用颜色、形状或声音，表达今天的心情。','把普通的纸盒变成一件有自己风格的小作品。'],try:'给天上的云起一个名字，画下它，并编一段小故事。',fields:'绘画设计、文学、音乐与表演',task:'cloud-story'},
    {id:'S',name:'温暖友善岛',type:'社会型',en:'SOCIAL',verb:'一起帮助',color:'#c2834b',soft:'#fff0d9',desc:'倾听朋友，分享方法，一起完成小挑战。让身边的人感到被理解、被照顾。',meaning:'对帮助、教导、陪伴和合作感兴趣，愿意关注别人的需要。',questions:['耐心教朋友一个你会玩的游戏，直到他也学会。','听家人讲今天的心情，再问一句“我能帮你什么？”','和同伴一起完成任务，照顾每个人参与的机会。'],try:'邀请家人互相说一件今天想感谢的小事，认真听完对方的回答。',fields:'教育、社会服务与团队协作',task:'team-help'},
    {id:'E',name:'显赫富庶岛',type:'企业型',en:'ENTERPRISING',verb:'发起行动',color:'#b17957',soft:'#fae7da',desc:'想一个计划，邀请伙伴加入，把大家的点子变成行动。小小发起人，今天想做什么？',meaning:'对提出目标、组织活动、沟通想法和推动计划感兴趣。',questions:['为周末设计一个家庭活动，并邀请大家参加。','向小伙伴介绍你的新点子，说说它有什么有趣的地方。','为一场小活动分配任务，带着大家一起准备。'],try:'发起一次家庭小展览：定主题、邀请观众，再安排一个小分工。',fields:'项目组织、创业体验与沟通策划',task:'family-show'},
    {id:'C',name:'现代井然岛',type:'事务型',en:'CONVENTIONAL',verb:'整理有序',color:'#648a9a',soft:'#e1f0f2',desc:'分类收藏，整理清单，把复杂的事情一步步安排好。整齐的小世界，也藏着成就感。',meaning:'对整理信息、记录细节和按步骤完成任务感兴趣。',questions:['按自己定的规则给书本或玩具分类，方便下次找到。','为一次出门写好物品清单，再逐项检查。','把观察到的事情记成小表格，仔细核对有没有遗漏。'],try:'挑一小格抽屉，定一个分类规则，再为每一类做一个标签。',fields:'信息管理、记录整理与流程规划',task:'sort-desk'},
  ];
  window.RIASEC = Object.freeze({islands,version:'dingdong-interest-1',source:'https://www.onetcenter.org/IP.html'});
})();
