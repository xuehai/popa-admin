# 微信云数据库任务状态更新功能

本文档说明如何配置和使用微信云数据库来更新打印任务状态。

## 功能特性

✅ **真实数据库更新**：集成微信云数据库HTTP API，实现真正的数据持久化  
✅ **降级机制**：当云数据库不可用时，自动降级到模拟模式  
✅ **错误处理**：完善的错误处理和日志记录  
✅ **状态验证**：严格的状态值验证，确保数据一致性  
✅ **操作反馈**：返回详细的更新结果信息  

## 配置步骤

### 1. 环境变量配置

复制 `.env.example` 为 `.env` 文件，并配置以下变量：

```bash
# 微信云开发环境ID
WX_ENV_ID=your_cloud_env_id

# 微信云数据库访问令牌（二选一）
WX_ACCESS_TOKEN=your_access_token
# 或者
WX_CLOUDBASE_ACCESS_TOKEN=your_cloudbase_access_token
```

### 2. 获取访问令牌

#### 方法一：通过微信开发者工具
1. 打开微信开发者工具
2. 进入云开发控制台
3. 在设置中获取访问令牌

#### 方法二：通过API获取
```bash
curl -X GET "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=YOUR_APPID&secret=YOUR_SECRET"
```

### 3. 数据库集合配置

确保微信云数据库中存在 `print_tasks` 集合，包含以下字段：

```javascript
{
  "_id": "任务ID",
  "status": "任务状态", // pending, printed, delivered, completed, failed
  "updateTime": "更新时间",
  // 其他任务相关字段...
}
```

## API 使用说明

### 更新任务状态

**接口地址：** `POST /api/tasks/update-status`

**请求参数：**
```javascript
{
  "taskId": "任务ID",
  "status": "新状态" // pending, printed, delivered, completed, failed
}
```

**响应格式：**
```javascript
// 成功响应（云数据库模式）
{
  "success": true,
  "message": "状态更新成功",
  "data": {
    "taskId": "task_123",
    "status": "printed",
    "updateTime": "2024-01-01T12:00:00.000Z",
    "matched": 1,    // 匹配到的记录数
    "modified": 1    // 实际修改的记录数
  }
}

// 成功响应（模拟模式）
{
  "success": true,
  "message": "状态更新成功（模拟模式）",
  "data": {
    "taskId": "task_123",
    "status": "printed",
    "updateTime": "2024-01-01T12:00:00.000Z",
    "mode": "simulation"
  }
}

// 错误响应
{
  "success": false,
  "message": "错误信息"
}
```

## 技术实现

### 核心功能

1. **微信云数据库集成**
   - 使用官方HTTP API进行数据库操作
   - 支持 `access_token` 和 `cloudbase_access_token` 两种认证方式
   - 遵循微信云数据库API规范

2. **降级机制**
   - 当云数据库配置缺失或连接失败时，自动切换到模拟模式
   - 确保系统可用性，避免因外部依赖导致的服务中断

3. **错误处理**
   - 详细的错误日志记录
   - 用户友好的错误信息返回
   - 区分配置错误、网络错误和业务错误

### 状态流转

```
pending → printed → delivered → completed
    ↓         ↓          ↓
  failed    failed    failed
```

## 安全考虑

1. **访问令牌安全**
   - 访问令牌存储在环境变量中，不提交到代码仓库
   - 定期更新访问令牌
   - 使用HTTPS确保传输安全

2. **参数验证**
   - 严格验证输入参数
   - 限制允许的状态值
   - 防止SQL注入和其他安全漏洞

3. **权限控制**
   - 确保只有授权用户可以更新任务状态
   - 记录操作日志用于审计

## 故障排除

### 常见问题

1. **配置错误**
   ```
   错误：缺少微信云数据库配置：WX_ACCESS_TOKEN 和 WX_ENV_ID
   解决：检查 .env 文件中的环境变量配置
   ```

2. **访问令牌过期**
   ```
   错误：微信云数据库错误 42001: AccessToken过期
   解决：重新获取访问令牌并更新环境变量
   ```

3. **集合不存在**
   ```
   错误：微信云数据库错误 85088: 该APP未开通云开发
   解决：确保微信小程序已开通云开发服务
   ```

### 调试模式

启用详细日志：
```javascript
console.log('更新任务状态:', { taskId, status });
console.log('微信云数据库查询:', query);
```

## 性能优化

1. **连接池管理**
   - 复用HTTP连接
   - 设置合理的超时时间

2. **批量操作**
   - 支持批量更新多个任务状态
   - 减少API调用次数

3. **缓存策略**
   - 缓存访问令牌
   - 避免频繁的令牌刷新

## 监控和日志

- 记录所有数据库操作日志
- 监控API调用成功率
- 设置告警机制
- 定期检查访问令牌有效性

---

更多信息请参考：
- [微信云数据库HTTP API文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-http-api/database/databaseUpdate.html)
- [微信云开发官方文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/)