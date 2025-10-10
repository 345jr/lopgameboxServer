import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';
import type { Metadata } from '../types/metadata';
import type { CacheEntry } from '../types/metadata';
  

class ScrapeService {
  private browser: Browser | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  /**
   * 静态HTML提取元数据
   */
  private async fetchStaticMetadata(url: string): Promise<Partial<Metadata> | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const $ = cheerio.load(html);
      const getMeta = (name: string, property?: string) =>
        $(`meta[name='${name}']`).attr('content') ||
        (property ? $(`meta[property='${property}']`).attr('content') : '');

      const title = getMeta('', 'og:title') || getMeta('twitter:title') || $('title').text();
      const description = getMeta('', 'og:description') || getMeta('twitter:description') || getMeta('description');
      const keywords = getMeta('keywords');
      const favicon = $('link[rel="icon"]').attr('href') || '/favicon.ico';
      const ogTitle = getMeta('', 'og:title');
      const ogDescription = getMeta('', 'og:description');
      const ogImage = getMeta('', 'og:image');
      const ogType = getMeta('', 'og:type');
      const ogUrl = getMeta('', 'og:url');
      const twitterCard = getMeta('twitter:card');
      const twitterTitle = getMeta('twitter:title');
      const twitterDescription = getMeta('twitter:description');
      const twitterImage = getMeta('twitter:image');
      const author = getMeta('author');
      const publisher = getMeta('publisher');
      const charset = $('meta[charset]').attr('charset') || '';
      const language = $('html').attr('lang') || '';
      const robots = getMeta('robots');

      // 关键字段齐全则返回
      if (title || description) {
        return {
          title,
          description,
          keywords,
          url,
          favicon,
          ogTitle,
          ogDescription,
          ogImage,
          ogType,
          ogUrl,
          twitterCard,
          twitterTitle,
          twitterDescription,
          twitterImage,
          author,
          publisher,
          charset,
          language,
          robots
        };
      }
      return null;
    } catch (err) {
      logger.warn(`静态HTML元数据提取失败: ${url}，错误: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
  /**
   * 初始化浏览器实例
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      };

      // 在 Docker 容器中使用系统 Chromium
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      this.browser = await puppeteer.launch(launchOptions);
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
        logger.info(`命中缓存，直接返回元数据: ${url}`);
        return cached;
      }
    }

    // 优先静态HTML提取
    const staticMeta = await this.fetchStaticMetadata(url);
    if (staticMeta && staticMeta.title) {
      logger.info(`静态HTML元数据提取成功: ${url}`);
      // 补齐部分字段为默认值
      const metadata: Metadata = {
        title: staticMeta.title || '',
        description: staticMeta.description || '',
        keywords: staticMeta.keywords || '',
        url: staticMeta.url || url,
        favicon: staticMeta.favicon || '',
        ogTitle: staticMeta.ogTitle || '',
        ogDescription: staticMeta.ogDescription || '',
        ogImage: staticMeta.ogImage || '',
        ogType: staticMeta.ogType || '',
        ogUrl: staticMeta.ogUrl || '',
        twitterCard: staticMeta.twitterCard || '',
        twitterTitle: staticMeta.twitterTitle || '',
        twitterDescription: staticMeta.twitterDescription || '',
        twitterImage: staticMeta.twitterImage || '',
        author: staticMeta.author || '',
        publisher: staticMeta.publisher || '',
        charset: staticMeta.charset || '',
        language: staticMeta.language || '',
        robots: staticMeta.robots || ''
      };
      if (useCache) {
        this.setCachedMetadata(url, metadata);
        this.cleanupCache();
      }
      return metadata;
    }

    logger.info(`静态HTML元数据提取失败，尝试Puppeteer动态抓取: ${url}`);
    let page: Page | null = null;

    try {
      // 验证URL格式
      new URL(url);

      const browser = await this.getBrowser();
      page = await browser.newPage();
      logger.info(`已打开新页面: ${url}`);

      // 启用请求拦截，阻止图片、媒体、字体、样式等重资源加载
      await page.setRequestInterception(true);
      page.on('request', req => {
        const type = req.resourceType();
        if ([
          'image',
          'media',
          'font',
          'stylesheet',
          'other'
        ].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 设置视口大小，模拟真实浏览器
      await page.setViewport({ width: 1920, height: 1080 });

      // 设置User-Agent和元数据，避免被网站识别为爬虫
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        {
          brands: [
            { brand: 'Google Chrome', version: '131' },
            { brand: 'Chromium', version: '131' },
            { brand: 'Not_A Brand', version: '24' }
          ],
          fullVersionList: [
            { brand: 'Google Chrome', version: '131.0.6778.86' },
            { brand: 'Chromium', version: '131.0.6778.86' },
            { brand: 'Not_A Brand', version: '24.0.0.0' }
          ],
          platform: 'Windows',
          platformVersion: '10.0.0',
          architecture: 'x86',
          model: '',
          mobile: false,
          bitness: '64',
          wow64: false
        }
      );

      // 设置额外的请求头
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      // 导航到页面，放宽等待策略为 networkidle2，缩短超时
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 20000
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

      logger.info(`抓取成功: ${url}`);

      // 缓存结果
      if (useCache) {
        this.setCachedMetadata(url, metadata);
        this.cleanupCache(); // 清理过期缓存
      }

      return metadata as Metadata;

    } catch (error) {
      logger.error(`抓取元数据失败: ${url}，错误: ${error instanceof Error ? error.message : error}`);
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
