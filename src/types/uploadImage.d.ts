export interface UploadValidationError {
  originalName: string;
  error: string;
}

export interface UploadConfigType {
  maxFileSize: number; // 单个文件最大大小（字节）
  maxBatchCount: number; // 批量上传最大文件数
}