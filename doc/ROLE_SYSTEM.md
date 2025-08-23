# 角色分类功能说明

## 新增功能

### 1. 用户角色系统
- **普通用户 (user)**: 默认角色，拥有基本权限
- **管理员 (admin)**: 拥有管理权限，可以查看和管理用户

### 2. 更新的接口

#### 注册接口 `/register` (POST)
现在支持管理员注册：

```json
// 普通用户注册
{
  "username": "testuser",
  "password": "password123"
}

// 管理员注册 (需要管理员密钥)
{
  "username": "admin",
  "password": "adminpass",
  "adminSecretKey": "admin_secret_key_2024"
}
```

**响应示例**:
```json
{
  "message": "注册成功，您的角色是: 管理员",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### 登录接口 `/login` (POST)
返回的用户信息现在包含角色：

```json
{
  "message": "登录成功",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### 获取当前用户信息 `/me` (GET)
现在返回角色信息：

```json
{
  "message": "获取用户信息成功",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 3. 新增的管理员专用接口

#### 获取用户列表 `/users` (GET) - 仅管理员
获取所有用户的列表和统计信息。

**请求头**:
```
Authorization: Bearer admin_jwt_token
```

**响应示例**:
```json
{
  "message": "获取用户列表成功",
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "role": "admin",
        "created_at": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": 2,
        "username": "user1",
        "role": "user",
        "created_at": "2024-01-01T01:00:00.000Z"
      }
    ],
    "statistics": {
      "total": 2,
      "admins": 1,
      "regularUsers": 1
    }
  }
}
```

#### 获取单个用户信息 `/users/:id` (GET) - 仅管理员
根据用户ID获取特定用户信息。

**请求示例**: `GET /users/1`

**响应示例**:
```json
{
  "message": "获取用户信息成功",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 环境配置

在 `.env` 文件中可以设置管理员密钥：

```env
ADMIN_SECRET_KEY=your_custom_admin_key
```

如果不设置，默认密钥为：`admin_secret_key_2024`

## 权限控制

- **authMiddleware**: 验证用户是否已登录
- **adminMiddleware**: 验证用户是否为管理员
- 管理员接口需要同时通过两个中间件验证

## 数据库变更

用户表新增了 `role` 字段：
- 类型: TEXT
- 默认值: 'user'  
- 约束: 只能是 'user' 或 'admin'

现有用户会自动设置为普通用户角色。

## 错误响应

- `400`: 管理员密钥不正确
- `401`: 未登录
- `403`: 权限不足，仅管理员可以访问
- `404`: 用户不存在
