// Finite sourced editorial collections: broad prompts never go through unrelated AI search snippets.
const r=(title,fact,question,topics,provider,url,icon)=>({title,fact,question,topics,provider,url,icon});
const records=[
r('最深的海洋：挑战者深渊','太平洋马里亚纳海沟的挑战者深渊，NOAA 测得约 10,935 米；测量方法与年份不同会有差异。','世界上最深的海沟在哪里？',['世界之最','自然地理'],'NOAA','https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/','🌊'),
r('最长的山脉系统：全球大洋中脊','全长约 65,000 公里，超过 90% 在海底。若只比较陆地山脉，口径不同。','地球上最长的山脉是哪座？',['世界之最','自然地理'],'NOAA','https://oceanservice.noaa.gov/facts/midoceanridge.html','🗻'),
r('最大的海洋盆地：太平洋','太平洋海盆面积约 1.62 亿平方公里，是全球最大的海洋盆地。','世界上最大的海洋是哪一个？',['世界之最','自然地理','生活常识'],'NOAA','https://oceanservice.noaa.gov/facts/biggestocean.html','🌏'),
r('最大的热带雨林：亚马孙雨林','位于南美洲亚马孙流域，是 NASA 资料所述地球最大的热带雨林。','世界上最大的热带雨林在哪里？',['世界之最','自然地理'],'NASA','https://science.nasa.gov/earth/earth-observatory/mapping-the-amazon-145649/','🌿'),
r('体形最大的动物：蓝鲸','蓝鲸是现存体形最大的动物，NOAA 将它称为地球上最大的动物。','地球上最大的动物是什么？',['世界之最','生活常识'],'NOAA Fisheries','https://www.fisheries.noaa.gov/species/blue-whale','🐋'),
r('平均密度最低的行星：土星','太阳系八大行星中土星平均密度最低，而且低于液态水的密度。','哪颗行星的平均密度最低？',['世界之最','科学发现','生活常识'],'NASA','https://science.nasa.gov/saturn/facts/','🪐'),
r('现存最早注明日期的完整印刷书：《金刚经》','敦煌《金刚经》印于 868 年；这不表示印刷术到那一年才出现。','第一部印刷书籍是什么？',['世界之最','历史人文'],'英国图书馆','https://idp.bl.uk/discover/learning/buddhism-on-the-silk-roads/articles/buddhism-on-the-ground/buddhist-texts-the-diamond-sutra/','📖'),
r('青霉素：从发现到临床','弗莱明 1928 年发现其抗菌作用，钱恩与弗洛里等人推动临床应用，三人分享 1945 年诺贝尔医学奖。','青霉素是谁发现的？',['科学发现','人物与奖项','历史人文'],'NobelPrize.org','https://www.nobelprize.org/prizes/medicine/1945/summary/','🔬'),
r('诺贝尔奖人数要先明确统计口径','出生地、国籍与获奖时机构所在国家并不是同一统计口径，不能直接混用。','出生于现今日本境内的诺贝尔奖获得者有多少位？',['人物与奖项'],'NobelPrize.org','https://www.nobelprize.org/laureates/','🏅'),
r('地球表面约 71% 被海洋覆盖','全球海洋覆盖地球表面约 71%，但绝大多数海水不能直接作为饮用淡水。','地球表面有多少比例被海洋覆盖？',['生活常识','自然地理'],'NOAA','https://oceanservice.noaa.gov/facts/howmanyoceans.html','💧')
];
const topics=['自然地理','历史人文','人物与奖项','科学发现','世界之最','生活常识'];
export function exploreCollection(question){
 const q=String(question||'').replace(/\s+/g,'').replace(/[？?！!。]+$/g,'');
 const topic=topics.find(x=>q.includes(x));
 const general=/(?:有哪些|有什么|有趣|常识|冷知识|推荐|入门|盘点|举例|介绍|分享|精选)/.test(q);
 const recordsIntent=/(?:世界之最|世界纪录|世界记录|全球之最)/.test(q);
 if(!general&&!recordsIntent)return null;
 if(!topic&&!recordsIntent&&!/(?:有趣|冷知识|常识|科普)/.test(q))return null;
 if(/(?:多少[位个]|哪个城市|发源于|谁发现|有多深|有多高|是哪座)/.test(q))return null;
 const selected=topic||'世界之最';
 const cards=records.filter(x=>x.topics.includes(selected)).slice(0,8);
 if(!cards.length)return null;
 return {answer:'为你精选 '+cards.length+' 条「'+selected+'」常识，每条都说明关键条件并附有可核对的原始资料。点击「深入了解」继续查询。',
 cards:cards.map(({title,fact,question,provider,url,icon})=>({title,fact,question,provider,url,icon})),
 sources:cards.map(x=>({provider:x.provider,title:x.title,url:x.url})),
 verified:'editorial-collection',ai:false,
 note:'这些是逐条附出处的固定专题，不是实时更新的完整排行榜；数值会随测量方法、来源版本和统计口径有所不同。'};
}
