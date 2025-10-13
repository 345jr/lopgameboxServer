export interface UserRow {
  id: number;
  username: string;
  password: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  created_at: string;
}
