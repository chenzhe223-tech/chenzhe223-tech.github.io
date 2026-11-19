// Manually reviewed fixed facts. Each has an accountable, directly linked source.
// This is NOT a general-purpose AI/real-time verification mechanism.
const facts = [
  {
    pattern: /长江.{0,16}(?:发源|源头|起源)|(?:发源|源头).{0,16}长江/,
    answer: '长江发源于青藏高原唐古拉山脉主峰各拉丹冬雪山西南侧，通常以沱沱河作为长江正源。长江源区还包括当曲、楚玛尔河等重要水系。',
    sources: [
      {provider:'中国科学院地理科学与资源研究所',title:'中国第一大河——长江',url:'https://www.igsnrr.cas.cn/cbkx/kpyd/dlzs/land/202009/t20200910_5692534.html'},
      {provider:'国家林业和草原局',title:'三江源国家公园总体规划相关资料',url:'https://www.forestry.gov.cn/u/cms/www/202404/121759143wjc.pdf'}
    ]
  },
  {
    pattern: /(?:哪颗|哪个|什么|何种)?.{0,5}行星.{0,12}(?:密度最低|密度最小)|(?:密度最低|密度最小).{0,10}行星/,
    answer: '太阳系八大行星中，平均密度最低的是土星。NASA 资料指出，土星也是唯一一颗平均密度低于液态水的行星。',
    sources:[{provider:'NASA',title:'Saturn: Facts',url:'https://science.nasa.gov/saturn/facts/'},{provider:'NASA',title:'Cassini Mission FAQ',url:'https://science.nasa.gov/mission/cassini/faq/'}]
  },
  {
    pattern: /青霉素.{0,15}(?:谁|发现|发明)|(?:谁|发现).{0,10}青霉素/,
    answer: '亚历山大·弗莱明（Alexander Fleming）于 1928 年发现青霉素的抗菌作用。后来恩斯特·钱恩和霍华德·弗洛里等人推动了青霉素的分离、研发和临床应用。三人共同获得 1945 年诺贝尔生理学或医学奖。',
    sources:[{provider:'NobelPrize.org',title:'1945 年诺贝尔生理学或医学奖官方资料',url:'https://www.nobelprize.org/prizes/medicine/1945/summary/'}]
  }
];
export const curatedAnswer = question => {
  const match = facts.find(f=>f.pattern.test(question));
  if (!match) return null;
  return {answer:match.answer, sources:match.sources, verified:'editorial-curated', note:'此条为经过来源人工校对的固定常识条目，非实时检索；若知识发生变化，请以来源网站最新内容为准。'};
};
