import type { UploadConfigType } from "../types/uploadImage";

// 默认配置
const DEFAULT_CONFIG: UploadConfigType = {
  maxFileSize: 10 * 1024 * 1024, // 10MB 
  maxBatchCount: 10
};

// 当前配置（支持动态修改）
let currentConfig: UploadConfigType = { ...DEFAULT_CONFIG };

export const uploadConfigManager = {
  /**
   * 获取当前配置
   */
  getConfig(): UploadConfigType {
    return { ...currentConfig };
  },

  /**
   * 获取单个文件最大大小
   */
  getMaxFileSize(): number {
    return currentConfig.maxFileSize;
  },

  /**
   * 获取批量上传最大文件数
   */
  getMaxBatchCount(): number {
    return currentConfig.maxBatchCount;
  },

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UploadConfigType>): UploadConfigType {
    // 验证配置值
    if (config.maxFileSize !== undefined) {
      if (config.maxFileSize <= 0) {
        throw new Error("maxFileSize 必须大于 0");
      }
      if (config.maxFileSize > 500 * 1024 * 1024) {
        throw new Error("maxFileSize 不能超过 500MB");
      }
    }

    if (config.maxBatchCount !== undefined) {
      if (config.maxBatchCount <= 0) {
        throw new Error("maxBatchCount 必须大于 0");
      }
      if (config.maxBatchCount > 500) {
        throw new Error("maxBatchCount 不能超过 500");
      }
    }

    // 更新配置
    currentConfig = {
      ...currentConfig,
      ...config
    };

    return { ...currentConfig };
  },

  /**
   * 重置为默认配置
   */
  resetConfig(): UploadConfigType {
    currentConfig = { ...DEFAULT_CONFIG };
    return { ...currentConfig };
  },

  /**
   * 格式化输出配置（用于响应）
   */
  getFormattedConfig() {
    return {
      maxFileSize: `${(currentConfig.maxFileSize / 1024 / 1024).toFixed(2)}MB`,
      maxFileSizeBytes: currentConfig.maxFileSize,
      maxBatchCount: currentConfig.maxBatchCount
    };
  }
};
