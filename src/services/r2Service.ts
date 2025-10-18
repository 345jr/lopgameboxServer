import { S3Client } from "bun";
import { config } from "../config/env";
import logger from "../utils/logger";

class R2Service {
  private client: S3Client | null;
  // private bucketName: string;
  // private publicUrl: string;

  constructor() {
    // 检查必需的环境变量
    if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY_ID || !config.R2_SECRET_ACCESS_KEY || !config.R2_BUCKET_NAME) {
      logger.warn("R2 配置不完整，文件上传功能可能无法正常工作");
      this.client = null;
      // this.bucketName = "";
      // this.publicUrl = "";
      return;
    }

    // this.bucketName = config.R2_BUCKET_NAME;
    // this.publicUrl = config.R2_PUBLIC_URL || `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      bucket: config.R2_BUCKET_NAME,
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      // 使用 Bun 原生 S3 客户端上传
      await this.client.write(fileName, file, {
        type: contentType,
      });

      logger.info(`文件上传成功: ${fileName}`);
      
      // 返回公开访问 URL
      return `${config.R2_PUBLIC_URL}/${fileName}`;
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      await this.client.delete(fileName);
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
      if (!this.client) {
        return false;
      }

      return await this.client.exists(fileName);
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      const file = this.client.file(fileName);
      const arrayBuffer = await file.arrayBuffer();
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      const file = this.client.file(fileName);
      const url = file.presign({
        expiresIn,
        method: "PUT",
      });

      return url;
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      const file = this.client.file(fileName);
      const url = file.presign({
        expiresIn,
        method: "GET",
      });

      return url;
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
      if (!this.client) {
        throw new Error("R2 客户端未初始化");
      }

      const result = await this.client.list({
        prefix,
        maxKeys,
      });

      return result;
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
