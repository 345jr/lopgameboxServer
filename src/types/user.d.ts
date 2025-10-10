export interface UserRow {
  id: number;
  username: string;
  password: string;
  role: 'user' | 'admin';
  created_at: string;
}
