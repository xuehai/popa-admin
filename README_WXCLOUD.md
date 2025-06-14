# 微信云数据库配置说明

## 概述

本项目已更新为使用微信云开发数据库来查询打印任务数据，而不是直接连接MySQL数据库。这符合微信小程序的开发规范。

## 配置步骤

### 1. 获取微信小程序配置信息

在微信公众平台（https://mp.weixin.qq.com/）获取以下信息：

- **AppID**: 小程序的唯一标识
- **AppSecret**: 小程序的密钥
- **云环境ID**: 云开发环境的标识

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入实际的配置值：

```env
# 微信小程序配置
WX_APP_ID=你的小程序AppID
WX_APP_SECRET=你的小程序AppSecret
WX_CLOUD_ENV=你的云环境ID
```

### 3. 数据库表结构

确保微信云数据库中存在 `print-tasks` 集合，包含以下字段：

```json
{
  "_id": "记录ID",
  "print_code": "打印编码",
  "status": "状态（pending/printing/completed/failed）",
  "user_id": "用户ID",
  "create_time": "创建时间（ISO格式）"
}
```

## API 调用流程

1. **获取 Access Token**
   - 使用 AppID 和 AppSecret 调用微信接口获取 access_token
   - API: `https://api.weixin.qq.com/cgi-bin/token`

2. **查询数据**
   - 使用 access_token 调用云数据库查询接口
   - API: `https://api.weixin.qq.com/tcb/databasequery`
   - 支持条件查询、排序、分页

3. **查询总数**
   - 单独查询符合条件的记录总数，用于分页计算

## 功能特性

- ✅ 支持按 `print_code` 模糊搜索
- ✅ 支持按 `create_time` 倒序排列
- ✅ 支持分页查询（每页30条）
- ✅ 自动降级到模拟数据（当微信API调用失败时）
- ✅ 完整的错误处理和日志记录

## 错误处理

当微信云数据库查询失败时，系统会自动切换到模拟数据模式，确保前端功能正常使用。常见的失败原因：

1. **配置错误**: AppID、AppSecret 或云环境ID 不正确
2. **网络问题**: 无法访问微信API服务器
3. **权限问题**: 云环境权限配置不当
4. **配额限制**: 超出微信云开发的调用配额

## 调试建议

1. 检查控制台日志，查看具体的错误信息
2. 验证 `.env` 文件中的配置是否正确
3. 确认微信云开发环境是否正常运行
4. 检查网络连接是否正常

## 相关文档

- [微信云开发数据库API文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-http-api/database/databaseQuery.html)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)