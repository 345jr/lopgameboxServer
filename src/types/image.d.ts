export interface ImageRow {
  id: number;
  user_id: number;
  file_name: string;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  tag: string | null;
  created_at: string;
}

export interface CreateImageData {
  user_id: number;
  file_name: string;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  tag?: string;
}
