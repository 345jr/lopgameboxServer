import { AwsClient } from "aws4fetch";
import { config } from "../config/env";
import logger from "../utils/logger";

class R2Service {
  private client: AwsClient;
  private r2Url: string;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    // 检查必需的环境变量
    if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY || !config.R2_BUCKET_NAME) {
      logger.warn("R2 配置不完整，文件上传功能可能无法正常工作");
    }

    this.bucketName = config.R2_BUCKET_NAME;
    this.r2Url = `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    this.publicUrl = config.R2_PUBLIC_URL || this.r2Url;

    this.client = new AwsClient({
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    });
  }

  /**
   * 上传文件到 R2
   * @param file 文件 Buffer
   * @param fileName 文件名
   * @param contentType 文件类型
   * @returns 文件 URL
   */
  async uploadFile(file: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}`;

      const response = await this.client.fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(file.length),
        },
        body: file as any,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`上传失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      logger.info(`文件上传成功: ${fileName}`);
      
      // 返回公开访问 URL
      if (config.R2_PUBLIC_URL) {
        return `${config.R2_PUBLIC_URL}/${fileName}`;
      }
      return `${this.r2Url}/${this.bucketName}/${fileName}`;
    } catch (error) {
      logger.error(`文件上传失败: ${error}`);
      throw error;
    }
  }

  /**
   * 删除 R2 中的文件
   * @param fileName 文件名
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}`;

      const response = await this.client.fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`删除失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      logger.info(`文件删除成功: ${fileName}`);
    } catch (error) {
      logger.error(`文件删除失败: ${error}`);
      throw error;
    }
  }

  /**
   * 检查文件是否存在
   * @param fileName 文件名
   * @returns 是否存在
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}`;

      const response = await this.client.fetch(url, {
        method: "HEAD",
      });

      return response.ok;
    } catch (error) {
      logger.error(`检查文件失败: ${error}`);
      return false;
    }
  }

  /**
   * 获取文件
   * @param fileName 文件名
   * @returns 文件内容
   */
  async getFile(fileName: string): Promise<Buffer> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}`;

      const response = await this.client.fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取文件失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error(`获取文件失败: ${error}`);
      throw error;
    }
  }

  /**
   * 生成预签名 URL (用于直接上传)
   * @param fileName 文件名
   * @param expiresIn 过期时间(秒)
   * @returns 预签名 URL
   */
  async generatePresignedUploadUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}?X-Amz-Expires=${expiresIn}`;

      const signedRequest = await this.client.sign(
        new Request(url, {
          method: "PUT",
        }),
        {
          aws: { signQuery: true },
        }
      );

      return signedRequest.url.toString();
    } catch (error) {
      logger.error(`生成预签名URL失败: ${error}`);
      throw error;
    }
  }

  /**
   * 生成预签名 URL (用于下载)
   * @param fileName 文件名
   * @param expiresIn 过期时间(秒)
   * @returns 预签名 URL
   */
  async generatePresignedDownloadUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    try {
      const url = `${this.r2Url}/${this.bucketName}/${fileName}?X-Amz-Expires=${expiresIn}`;

      const signedRequest = await this.client.sign(
        new Request(url, {
          method: "GET",
        }),
        {
          aws: { signQuery: true },
        }
      );

      return signedRequest.url.toString();
    } catch (error) {
      logger.error(`生成预签名URL失败: ${error}`);
      throw error;
    }
  }

  /**
   * 列出存储桶中的文件
   * @param prefix 文件前缀
   * @param maxKeys 最大返回数量
   * @returns 文件列表
   */
  async listFiles(prefix: string = "", maxKeys: number = 1000): Promise<any> {
    try {
      let url = `${this.r2Url}/${this.bucketName}?list-type=2&max-keys=${maxKeys}`;
      if (prefix) {
        url += `&prefix=${encodeURIComponent(prefix)}`;
      }

      const response = await this.client.fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`列出文件失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const xmlText = await response.text();
      // 这里返回原始 XML，实际使用时可以解析成 JSON
      return xmlText;
    } catch (error) {
      logger.error(`列出文件失败: ${error}`);
      throw error;
    }
  }

  /**
   * 检查 R2 配置是否完整
   */
  isConfigured(): boolean {
    return !!(
      config.R2_ACCOUNT_ID &&
      config.R2_ACCESS_KEY_ID &&
      config.R2_SECRET_ACCESS_KEY &&
      config.R2_BUCKET_NAME
    );
  }
}

export const r2Service = new R2Service();
