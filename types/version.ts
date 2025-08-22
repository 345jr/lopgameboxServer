// 版本行类型
export interface VersionRow {
  id: number;
  version: string;
  release_date: string;
  notes?: string | null;
}