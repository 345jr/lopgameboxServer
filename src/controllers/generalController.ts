import type { Request, Response } from "express";

export class GeneralController {
  // 测试接口
  static test(req: Request, res: Response) {
    res.send(
      "Hello World! 已登录，欢迎 " + ((req as any).user?.username || "用户") + "！"
    );
  }
}
