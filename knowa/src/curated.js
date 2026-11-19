// Manually reviewed fixed facts. Each has an accountable, directly linked source.
// This is NOT a general-purpose AI/real-time verification mechanism.
const facts = [
  {pattern:/最大.{0,8}(?:海洋|大洋)|(?:海洋|大洋).{0,8}最大/,answer:'太平洋是世界上最大的海洋盆地。NOAA 给出的海盆面积约为 1.62 亿平方公里。',sources:[{provider:'NOAA',title:'What is the largest ocean basin on Earth?',url:'https://oceanservice.noaa.gov/facts/biggestocean.html'}]},
  {pattern:/(?:最大|体型最大|体形最大).{0,10}(?:动物|生物)|(?:动物|生物).{0,10}(?:最大|体型最大|体形最大)/,answer:'蓝鲸是现存体形最大的动物。NOAA Fisheries 列出了蓝鲸的物种特征及保护现状。',sources:[{provider:'NOAA Fisheries',title:'Blue Whale',url:'https://www.fisheries.noaa.gov/species/blue-whale'}]},
  {pattern:/(?:地球|世界).{0,12}(?:表面|面积).{0,12}(?:海洋|海水)|(?:海洋|海水).{0,12}(?:覆盖|表面).{0,12}(?:地球|世界)/,answer:'NOAA 资料指出，全球海洋覆盖地球表面约 71%。',sources:[{provider:'NOAA',title:'How many oceans are there?',url:'https://oceanservice.noaa.gov/facts/howmanyoceans.html'}]},
  {
    pattern: /(?:最深|深度最大).{0,12}(?:海沟|海洋)|(?:海沟|海洋).{0,12}(?:最深|深度最大)/,
    answer: '目前已知海洋最深处是太平洋马里亚纳海沟南端的挑战者深渊（Challenger Deep）。NOAA 给出的深度测量约为 10,935 米；不同测量方法和年份会产生小幅差异。',
    sources:[{provider:'NOAA',title:'How deep is the ocean?',url:'https://oceanexplorer.noaa.gov/ocean-fact/ocean-depth/'}]
  },
  {
    pattern: /(?:最大|面积最大).{0,12}(?:热带雨林|雨林)|(?:热带雨林|雨林).{0,12}(?:最大|面积最大)/,
    answer: '世界上最大的热带雨林是亚马孙雨林（Amazon rainforest），主要分布在南美洲的亚马孙流域，横跨多个国家；其中巴西占据最大部分。',
    sources:[{provider:'NASA',title:'Mapping the Amazon',url:'https://science.nasa.gov/earth/earth-observatory/mapping-the-amazon-145649/'}]
  },
  {
    pattern: /(?:第一部|最早|年代最早).{0,12}(?:印刷书|印刷品|印本)|(?:印刷书|印本).{0,12}(?:第一部|最早)/,
    answer: '“世界第一部印刷书籍”需要限定定义。现存最早有明确印刷日期的完整印刷书籍是公元 868 年的敦煌《金刚经》，现藏英国图书馆。印刷技术与更早的零散印刷品并不是从这本书才开始。',
    sources:[{provider:'英国图书馆 · 国际敦煌项目',title:'The Diamond Sutra',url:'https://idp.bl.uk/discover/learning/buddhism-on-the-silk-roads/articles/buddhism-on-the-ground/buddhist-texts-the-diamond-sutra/'}]
  },
  {
    pattern: /(?:最长|最大).{0,12}(?:山脉|山系)|(?:山脉|山系).{0,12}(?:最长|最大)/,
    answer: '若包括海底，地球上最长的山脉系统是全球大洋中脊，绵延约 65,000 公里，其中超过 90% 位于海底。若仅讨论陆地山脉，通常指安第斯山脉；两者口径不能混用。',
    sources:[{provider:'NOAA',title:'What is a mid-ocean ridge?',url:'https://oceanexplorer.noaa.gov/ocean-fact/mid-ocean-ridge/'}]
  },
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
