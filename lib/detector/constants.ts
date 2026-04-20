import type { DetectorConfig, ScoreWeights } from "./types";

export const DEFAULT_BLOCKED_DOMAINS: string[] = [
  // ── 社交平台 ──
  "facebook.com", "linkedin.com", "twitter.com", "x.com",
  "instagram.com", "youtube.com", "tiktok.com", "reddit.com",
  "pinterest.com", "threads.net",
  // ── 国内社交/内容平台 ──
  "zhihu.com", "xiaohongshu.com", "douyin.com", "bilibili.com",
  "weibo.com", "douban.com", "toutiao.com", "163.com",
  "sohu.com", "baijiahao.baidu.com", "mp.weixin.qq.com",
  "csdn.net", "jianshu.com", "juejin.cn", "oschina.net",
  "51cto.com", "cnblogs.com", "segmentfault.com",
  // ── 企业查询/黄页 ──
  "tianyancha.com", "qcc.com", "aiqicha.baidu.com",
  "crunchbase.com", "bloomberg.com", "forbes.com",
  "glassdoor.com", "indeed.com", "yelp.com", "yell.com",
  "europages.com",
  // ── 电商/B2B平台 ──
  "amazon.com", "alibaba.com", "1688.com", "globalsources.com",
  "made-in-china.com", "dhgate.com", "aliexpress.com",
  // ── 百科/问答/知识类 ──
  "wikipedia.org", "wikihow.com", "quora.com", "stackoverflow.com",
  "baike.baidu.com", "zhidao.baidu.com", "docs.google.com",
  // ── 新闻/媒体 ──
  "bbc.com", "cnn.com", "reuters.com", "apnews.com", "nytimes.com",
  "thepaper.cn", "yicai.com", "caixin.com", "36kr.com",
  "jiemian.com", "cls.cn", "stcn.com", "nbd.com", "21jingji.com",
  "people.com.cn", "xinhuanet.com", "chinanews.com",
  // ── 其他（搜索引擎/大厂/技术社区）──
  "google.com", "baidu.com", "github.com", "gitlab.com",
  "medium.com", "dev.to", "hashnode.dev",
  "apple.com", "microsoft.com", "trustpilot.com",
];

export const DEFAULT_BLOCKED_TLDS: string[] = [
  ".gov", ".gov.cn", ".edu", ".edu.cn", ".mil", ".mil.cn",
  ".org.cn", ".ac.cn", ".gov.uk", ".edu.au", ".gouv.fr",
  ".gov.au", ".gc.ca", ".go.jp", ".go.kr", ".gob.mx",
];

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  domainQuality: 30,
  contentSignals: 25,
  negativeSignals: 20,
  navigationSignals: 15,
  contactSignals: 10,
};

export const DEFAULT_NAV_KEYWORDS: Record<string, string[]> = {
  en: [
    "about", "about us", "our company", "our story", "company profile",
    "contact", "contact us", "get in touch",
    "products", "services", "solutions",
    "factory", "manufacturer", "our factory", "factory tour",
  ],
  zh: [
    "关于我们", "公司简介", "企业介绍", "企业概况", "公司介绍",
    "联系我们", "联系方式", "在线留言",
    "产品中心", "产品展示", "全部产品",
    "服务项目", "服务内容",
    "工厂", "生产基地", "生产车间", "生产实力",
  ],
  ja: [
    "会社概要", "企業情報", "会社案内", "会社紹介",
    "お問い合わせ", "お問合せ", "ご連絡先",
    "製品", "サービス", "ソリューション",
    "工場", "生産拠点",
  ],
  ko: [
    "회사소개", "기업소개", "회사정보",
    "문의하기", "연락처", "고객센터",
    "제품", "서비스", "솔루션",
    "공장", "생산시설",
  ],
  de: [
    "über uns", "unternehmen", "firma", "firmenprofil",
    "kontakt", "kontaktieren", "anfrage",
    "produkte", "leistungen", "lösungen",
    "fabrik", "werk", "produktion",
  ],
  fr: [
    "à propos", "notre entreprise", "qui sommes-nous", "présentation",
    "contact", "nous contacter", "demande de renseignements",
    "produits", "services", "solutions",
    "usine", "fabrication", "notre usine",
  ],
  es: [
    "sobre nosotros", "nuestra empresa", "quienes somos", "perfil de empresa",
    "contacto", "contáctenos",
    "productos", "servicios", "soluciones",
    "fábrica", "planta de producción",
  ],
  pt: [
    "sobre nós", "nossa empresa", "quem somos", "perfil da empresa",
    "contato", "fale conosco",
    "produtos", "serviços", "soluções",
    "fábrica", "planta de produção",
  ],
};

export const DEFAULT_CONFIG: DetectorConfig = {
  blockedDomains: DEFAULT_BLOCKED_DOMAINS,
  blockedTlds: DEFAULT_BLOCKED_TLDS,
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  navKeywords: DEFAULT_NAV_KEYWORDS,
  enablePlaywright: false,
};

export const MINIMUM_SCORE_THRESHOLD = 25;

export const MAX_CONCURRENT_FETCHES = 5;

export const FETCH_TIMEOUT_MS = 15000;

export const MAX_CANDIDATES_TO_FETCH = 8;
