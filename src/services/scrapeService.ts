import puppeteer, { Browser, Page } from 'puppeteer';

interface Metadata {
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
interface CacheEntry {
  data: Metadata;
  timestamp: number;
}

class ScrapeService {
  private browser: Browser | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 初始化浏览器实例
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
    }
    return this.browser;
  }

  /**
   * 检查缓存
   */
  private getCachedMetadata(url: string): Metadata | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(url);
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCachedMetadata(url: string, metadata: Metadata): void {
    this.cache.set(url, {
      data: metadata,
      timestamp: Date.now()
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取网页元数据
   * @param url 要抓取的网页URL
   * @param useCache 是否使用缓存，默认为 true
   * @returns 网页元数据对象
   */
  async getMetadata(url: string, useCache: boolean = true): Promise<Metadata> {
    // 检查缓存
    if (useCache) {
      const cached = this.getCachedMetadata(url);
      if (cached) {
        console.log(`从缓存中获取元数据: ${url}`);
        return cached;
      }
    }
    
    let page: Page | null = null;
    
    try {
      // 验证URL格式
      new URL(url);
      
      const browser = await this.getBrowser();
      page = await browser.newPage();
      
      // 设置视口大小，模拟真实浏览器
      await page.setViewport({ width: 1920, height: 1080 });
      
      // 设置User-Agent，避免被网站识别为爬虫
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // 设置额外的请求头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });
      
      // 导航到页面，使用多种等待策略
      await page.goto(url, { 
        waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
        timeout: 30000 
      });
      
      // 等待页面完全加载和渲染
      await page.waitForSelector('head', { timeout: 5000 }).catch(() => {});
      
      // 等待额外的时间让JavaScript执行完成
      await page.waitForFunction(
        () => document.readyState === 'complete',
        { timeout: 10000 }
      ).catch(() => {});
      
      // 再等待一段时间，确保动态内容加载完成
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 尝试等待标题变化（如果初始标题包含"加载"、"请稍候"等关键词）
      try {
        await page.waitForFunction(
          () => {
            const title = document.title;
            const loadingKeywords = ['loading', 'please wait', '请稍候', '加载中', 'wait'];
            return !loadingKeywords.some(keyword => 
              title.toLowerCase().includes(keyword.toLowerCase())
            );
          },
          { timeout: 5000 }
        );
      } catch (e) {
        // 如果等待超时，继续执行
      }
      
      // 在页面上下文中执行脚本，提取元数据
      const metadata = await page.evaluate(() => {
        const getMetaContent = (name: string, property?: string): string => {
          let element = document.querySelector(`meta[name="${name}"]`);
          if (!element && property) {
            element = document.querySelector(`meta[property="${property}"]`);
          }
          return element?.getAttribute('content') || '';
        };

        const getFavicon = (): string => {
          const iconLink = document.querySelector('link[rel="icon"]') || 
                          document.querySelector('link[rel="shortcut icon"]') ||
                          document.querySelector('link[rel="apple-touch-icon"]');
          let href = iconLink?.getAttribute('href') || '/favicon.ico';
          
          // 处理 data URI
          if (href.startsWith('data:')) {
            return href;
          }
          
          // 处理相对路径
          if (href.startsWith('http')) {
            return href;
          } else if (href.startsWith('//')) {
            return `${window.location.protocol}${href}`;
          } else if (href.startsWith('/')) {
            return `${window.location.origin}${href}`;
          } else {
            return `${window.location.origin}/${href}`;
          }
        };

        // 智能获取标题 - 优先级：og:title > twitter:title > title
        const getTitle = (): string => {
          const ogTitle = getMetaContent('', 'og:title');
          const twitterTitle = getMetaContent('twitter:title');
          const pageTitle = document.title;
          
          return ogTitle || twitterTitle || pageTitle || '';
        };

        // 智能获取描述 - 优先级：og:description > twitter:description > description
        const getDescription = (): string => {
          const ogDesc = getMetaContent('', 'og:description');
          const twitterDesc = getMetaContent('twitter:description');
          const metaDesc = getMetaContent('description');
          
          return ogDesc || twitterDesc || metaDesc || '';
        };

        return {
          title: getTitle(),
          description: getDescription(),
          keywords: getMetaContent('keywords') || '',
          url: window.location.href,
          favicon: getFavicon(),
          
          // Open Graph
          ogTitle: getMetaContent('', 'og:title') || '',
          ogDescription: getMetaContent('', 'og:description') || '',
          ogImage: getMetaContent('', 'og:image') || '',
          ogType: getMetaContent('', 'og:type') || '',
          ogUrl: getMetaContent('', 'og:url') || '',
          
          // Twitter Card
          twitterCard: getMetaContent('twitter:card') || '',
          twitterTitle: getMetaContent('twitter:title') || '',
          twitterDescription: getMetaContent('twitter:description') || '',
          twitterImage: getMetaContent('twitter:image') || '',
          
          // 其他
          author: getMetaContent('author') || '',
          publisher: getMetaContent('publisher') || '',
          charset: document.characterSet || '',
          language: document.documentElement.lang || '',
          robots: getMetaContent('robots') || ''
        };
      });
      
      // 缓存结果
      if (useCache) {
        this.setCachedMetadata(url, metadata);
        this.cleanupCache(); // 清理过期缓存
      }
      
      return metadata as Metadata;
      
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`抓取元数据失败: ${error.message}`);
      }
      throw new Error('抓取元数据时发生未知错误');
    } finally {
      // 关闭页面
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// 导出单例
export default new ScrapeService();
