# lopgameboxServer API 文档

说明：本项目在 Bun 运行时（使用 `bun:sqlite`）下运行，使用 JWT 做认证。以下接口基于当前 `index.ts` 实现整理。

通用说明
- Base URL: http://localhost:8080
- Content-Type: application/json
- 认证：需要登录的接口通过 `Authorization: Bearer <token>` 头传输 JWT
- 数据库：SQLite 文件位于 `./data/server.db`，版本信息表为 `versions`。

错误处理
- 常见状态码：400（Bad Request）、401（Unauthorized）、403（Forbidden）、404（Not Found）、409（Conflict）、500（Internal Server Error）

接口列表

## POST /register
注册新用户并返回 token。

请求体
```json
{ "username": "string", "password": "string" }
```
成功响应 200
```json
{
  "message": "注册成功",
  "token": "<jwt>",
  "user": { "id": 1, "username": "alice" }
}
```
错误
- 400：缺少字段
- 409：用户名已存在
- 500：注册失败（数据库/其它错误）

---

## POST /login
登录并获取 token。

请求体
```json
{ "username": "string", "password": "string" }
```
成功响应 200
```json
{
  "message": "登录成功",
  "token": "<jwt>",
  "user": { "id": 1, "username": "alice" }
}
```
错误
- 400：缺少字段
- 401：用户名或密码错误
- 500：登录失败

---

## GET /
测试接口，需认证。

Headers
```
Authorization: Bearer <token>
```
成功响应 200：返回文本欢迎信息

---

## POST /check-update
检查是否有新版本，使用 `versions` 表中按 `release_date` 最新的记录进行比较。

请求体
```json
{ "version": "string" }
```
成功响应（已是最新） 200
```json
{ "update": false, "message": "已是最新版本", "latest": "2.0" }
```
成功响应（有更新） 200
```json
{
  "update": true,
  "latest": "2.0",
  "release_date": "2025-08-20T12:00:00Z",
  "notes": "修复若干 bug",
  "message": "有新版本: 2.0"
}
```
错误
- 400：缺少版本号
- 404：未找到版本信息（versions 表为空）
- 500：检查更新失败

---

## POST /versions
添加一条新版本信息，需要认证。

Headers
```
Authorization: Bearer <token>
```
请求体
```json
{
  "version": "string",      // 必需
  "release_date": "string",// 可选，ISO 时间字符串，默认服务器当前时间
  "notes": "string"        // 可选
}
```
成功响应 201
```json
{ "message": "添加成功", "version": { "id": 3, "version": "2.1", "release_date": "...", "notes": "..." } }
```
错误
- 400：缺少 version
- 409：版本号已存在（唯一约束）
- 500：添加失败

---

## DELETE /versions/:id
按 id 删除版本，需要认证。

Headers
```
Authorization: Bearer <token>
```
成功响应 200
```json
{ "message": "删除成功", "id": 3 }
```
错误
- 400：无效的 id
- 404：未找到该版本
- 500：删除失败

---

## DELETE /versions
按 version 字符串删除版本，需要认证（备用）。

请求体
```json
{ "version": "2.1" }
```
成功响应 200
```json
{ "message": "删除成功", "version": "2.1" }
```

---

## POST /backup
上传客户端（前端）生成的 SQLite 备份（base64 编码），需要认证。

Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```
请求体
```json
{
  "userId": "optional",    // 可选，优先使用；否则使用 token 中的 user.id，如果都没有则为 "anonymous"
  "filename": "optional",  // 可选，服务器会对名字做安全化处理
  "file": "<base64-string>" // 必需，base64 编码的 sqlite 文件二进制
}
```
成功响应 201
```json
{ "message": "备份保存成功", "path": "<server-path>" }
```
错误
- 400：缺少文件数据
- 500：写入失败（权限/磁盘/其它）

---

示例：使用 PowerShell 调用（含 token）
```powershell
$body = @{ username = 'alice'; password = 'pass' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/register -Body $body -ContentType 'application/json'

# 假设取得 $token
$backup = @{ userId = 1; filename = 'client.db'; file = '<BASE64>' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:8080/backup -Body $backup -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" }
```

运行与依赖
- 本项目已改为仅支持 Bun 运行时（使用 `bun:sqlite`）。
- 启动：
```powershell
bun run index.ts
```

升级建议 & 注意事项
- 备份文件建议使用 multipart/form-data 流式上传以避免内存/大小限制。
- 备份文件含敏感数据时请确保传输和存储加密，或在客户端提前对敏感字段加密。
- 若需要更细粒度权限（例如仅 admin 能增删版本），在 `authMiddleware` 中添加角色判断。

文档结束。
