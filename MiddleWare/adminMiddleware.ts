import type { Request, Response, NextFunction } from "express";

export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({ error: "未登录" });
  }
  
  if (user.role !== 'admin') {
    return res.status(403).json({ error: "权限不足，仅管理员可以访问此接口" });
  }
  
  next();
}
