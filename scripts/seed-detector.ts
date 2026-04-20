/**
 * 初始化网站检测器黑名单数据到 systemConfigs 表
 *
 * 运行方式：
 *   npx tsx scripts/seed-detector.ts
 *
 * 数据来源：用户手动整理的分类黑名单
 */

const blockedDomains = [
  // ── 社交平台 ──
  "facebook.com", "linkedin.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "tiktok.com", "reddit.com", "pinterest.com", "threads.net",

  // ── 国内社交/内容平台 ──
  "zhihu.com", "xiaohongshu.com", "douyin.com", "bilibili.com",
  "weibo.com", "douban.com", "toutiao.com", "163.com",
  "sohu.com", "baijiahao.baidu.com", "mp.weixin.qq.com",
  "csdn.net", "jianshu.com", "juejin.cn", "oschina.net",
  "51cto.com", "cnblogs.com", "segmentfault.com",

  // ── 企业查询/黄页 ──
  "tianyancha.com", "qcc.com", "aiqicha.baidu.com",
  "crunchbase.com", "bloomberg.com", "forbes.com",
  "glassdoor.com", "indeed.com",
  "yelp.com", "yell.com", "europages.com",

  // ── 电商/B2B平台 ──
  "amazon.com", "alibaba.com", "1688.com", "globalsources.com",
  "made-in-china.com", "dhgate.com", "aliexpress.com",

  // ── 百科/问答/知识类 ──
  "wikipedia.org", "wikihow.com", "quora.com", "stackoverflow.com",
  "baike.baidu.com", "zhidao.baidu.com", "docs.google.com",

  // ── 新闻/媒体 ──
  "bbc.com", "cnn.com", "reuters.com", "apnews.com", "nytimes.com",
  "thepaper.cn", "yicai.com", "caixin.com", "36kr.com", "jiemian.com",
  "cls.cn", "stcn.com", "nbd.com", "21jingji.com", "people.com.cn",
  "xinhuanet.com", "chinanews.com",
];

const blockedTlds = [
  ".gov", ".gov.cn", ".edu", ".edu.cn", ".mil", ".mil.cn",
  ".org.cn", ".ac.cn", ".gov.uk", ".edu.au", ".gouv.fr",
  ".gov.au", ".gc.ca", ".go.jp", ".go.kr", ".gob.mx",
];

const scoreWeights = {
  domainQuality: 30,
  contentSignals: 25,
  negativeSignals: 20,
  navigationSignals: 15,
  contactSignals: 10,
};

async function main() {
  const { db } = await import("../lib/db");
  const { systemConfigs } = await import("../lib/db/schema");

  const entries = [
    {
      key: "DETECTOR_BLOCKED_DOMAINS",
      value: JSON.stringify(blockedDomains),
      description: "网站检测器 - 域名黑名单",
    },
    {
      key: "DETECTOR_BLOCKED_TLDS",
      value: JSON.stringify(blockedTlds),
      description: "网站检测器 - TLD黑名单",
    },
    {
      key: "DETECTOR_SCORE_WEIGHTS",
      value: JSON.stringify(scoreWeights),
      description: "网站检测器 - 评分权重",
    },
    {
      key: "DETECTOR_ENABLE_PLAYWRIGHT",
      value: "false",
      description: "网站检测器 - Playwright开关",
    },
  ];

  for (const entry of entries) {
    await db
      .insert(systemConfigs)
      .values(entry)
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: entry.value, description: entry.description, updatedAt: new Date() },
      });
    console.log(`  ✓ ${entry.key}`);
  }

  console.log(`\nDone. Inserted ${blockedDomains.length} domains, ${blockedTlds.length} TLDs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
