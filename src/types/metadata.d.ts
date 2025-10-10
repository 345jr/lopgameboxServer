//元数据类型
export interface Metadata {
  title: string;
  description: string;
  keywords: string;
  url: string;
  favicon: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  ogUrl: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  author: string;
  publisher: string;
  charset: string;
  language: string;
  robots: string;
}

// 简单的内存缓存
export interface CacheEntry {
  data: Metadata;
  timestamp: number;
}