const path = require("path");
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, AdminUser, PrintTask } = require("./db");
const { equal } = require("assert");

const logger = morgan("tiny");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 登录页面
app.get("/login", async (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// 管理后台首页
app.get("/home", async (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

// 登录API
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('收到登录请求:', username, password);
    
    if (!username || !password) {
      return res.json({
        code: 1,
        message: "请输入账号和密码"
      });
    }
    
    try {
      // 尝试查找用户
      const user = await AdminUser.findOne({
        where: {
          username: username,
          password: password // 前端已经MD5加密
        }
      });
      
      if (user) {
        res.json({
          code: 0,
          message: "登录成功",
          data: {
            username: user.username
          }
        });
      } else {
        res.json({
          code: 1,
          message: "账号或密码错误"
        });
      }
    } catch (dbError) {
      console.log("数据库查询失败，使用模拟登录:", dbError.message);
      
      // 模拟登录 - 仅用于演示
      // 实际生产环境中应该有真实的用户验证
      if (username === 'admin' && password === '21232f297a57a5a743894a0e4a801fc3') { // admin的MD5
        res.json({
          code: 0,
          message: "登录成功 (模拟模式)",
          data: {
            username: username
          }
        });
      } else {
        res.json({
          code: 1,
          message: "账号或密码错误 (模拟模式: 请使用 admin/admin)"
        });
      }
    }
  } catch (error) {
    console.error("登录错误:", error);
    res.json({
      code: 1,
      message: "服务器错误"
    });
  }
});

// 获取打印任务列表API
app.get("/api/print-tasks", async (req, res) => {
  try {
    const { page = 1, pageSize = 30, search = '' } = req.query;
    const offset = (page - 1) * pageSize;
    
    try {
      // 调用微信云开发数据库查询API
      const result = await queryWxCloudDatabase({
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        search: search
      });
      
      res.json({
        code: 0,
        data: result
      });
    } catch (wxError) {
      console.log("微信云数据库查询失败:", wxError.message);
    }
  } catch (error) {
    console.error("获取打印任务失败:", error);
    res.json({
      code: 1,
      message: "服务器错误"
    });
  }
});

// 查询微信云开发数据库
// 获取微信云开发access_token的独立函数
async function getWxCloudAccessToken() {
  const axios = require('axios');
  
  // 微信云开发配置（需要配置实际的值）
  const WX_CLOUD_CONFIG = {
    appId: 'wx61291ca2978a97ec',
    appSecret: 'd58b4cc3f0590637de173fbaf4cd8d2d',
    env: 'art-fans-cloud-8gk5o7dr7f4b9545'
  };
  
  try {
    // 获取access_token
    const tokenResponse = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: WX_CLOUD_CONFIG.appId,
        secret: WX_CLOUD_CONFIG.appSecret
      }
    });
    
    if (tokenResponse.data.errcode) {
      throw new Error(`获取access_token失败: ${tokenResponse.data.errmsg}`);
    }
    
    return {
      accessToken: tokenResponse.data.access_token,
      env: WX_CLOUD_CONFIG.env
    };
    
  } catch (error) {
    console.error('获取微信云开发access_token失败:', error.message);
    throw error;
  }
}

async function queryWxCloudDatabase({ page, pageSize, search }) {
  const axios = require('axios');
  
  try {
    // 1. 获取access_token和环境配置
    const { accessToken, env } = await getWxCloudAccessToken();
    
    // 2. 构建查询语句
    const collectionName = 'print_tasks';
    let query = `db.collection("${collectionName}")`;
    
    // 添加搜索条件（转义特殊字符）
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query += `.where({print_code: db.RegExp({regexp: "${escapedSearch}", options: "i"})})`;
    }
    
    // 指定查询字段，排除create_time
    query += '.field({create_time: true, print_code: true, status: true, user_id: true, _id: true})';
    
    // 添加排序和分页（注意：排序字段不在field中时可能会出错，这里改为按_id排序）
    const offset = (page - 1) * pageSize;
    query += `.orderBy("_id", "desc").skip(${offset}).limit(${pageSize}).get()`;
    
    // 3. 查询数据
    const queryResponse = await axios.post('https://api.weixin.qq.com/tcb/databasequery', {
      env: env,
      query: query
    }, {
      params: {
        access_token: accessToken
      }
    });
    
    if (queryResponse.data.errcode !== 0) {
      throw new Error(`查询数据失败: ${queryResponse.data.errmsg}`);
    }
    
    let data = queryResponse.data.data;
    
    let records = [];
    try {
      if (data) {
        // 检查数据是否已经是对象
        if (typeof data === 'string') {
          records = JSON.parse(data);
        } else {
          records = data;
        }
      }
    } catch (parseError) {
      console.error('解析查询结果JSON失败:', parseError.message);
      console.error('原始数据:', data);
      console.error('数据长度:', data ? data.length : 'null');
      throw new Error(`数据解析失败: ${parseError.message}`);
    }

    let total = records.length

    return {
      list: records,
      total: total,
      page: page,
      pageSize: pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
    
  } catch (error) {
    console.error('微信云数据库查询错误:', error.message);
    throw error;
  }
}

// 更新任务状态
app.post("/api/tasks/update-status", async (req, res) => {
  try {
    const { taskId, status } = req.body;
    
    if (!taskId || !status) {
      return res.json({
        success: false,
        message: "缺少必要参数：taskId 和 status"
      });
    }
    
    // 验证状态值
    const validStatuses = ['pending', 'printed', 'delivered', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.json({
        success: false,
        message: "无效的状态值"
      });
    }
    
    console.log('更新任务状态:', { taskId, status });
    
    try {
      // 尝试使用微信云数据库更新
      const updateResult = await updateWxCloudTask(taskId, status);
      
      if (updateResult.success) {
        res.json({
          success: true,
          message: "状态更新成功",
          data: {
            taskId,
            status,
            updateTime: new Date().toISOString(),
            matched: updateResult.matched,
            modified: updateResult.modified
          }
        });
      } else {
        throw new Error(updateResult.message || '微信云数据库更新失败');
      }
      
    } catch (wxError) {
      console.warn('微信云数据库更新失败:', wxError.message);
    }
    
  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.json({
      success: false,
      message: "更新失败：" + error.message
    });
  }
});

// 微信云数据库任务更新函数
async function updateWxCloudTask(taskId, status) {
  try {
    // 获取access_token和环境配置
    let accessToken, envId;
    
    try {
      const tokenData = await getWxCloudAccessToken();
      accessToken = tokenData.accessToken;
      envId = tokenData.env;
    } catch (tokenError) {
      throw new Error('获取微信云数据库访问令牌失败：' + tokenError.message);
    }
    
    // 构建更新查询语句
    const query = `db.collection("print_tasks").doc("${taskId}").update({data:{status: "${status}", updateTime: "${new Date().toISOString()}"}})`;  
    
    // 调用微信云数据库HTTP API - 将access_token作为URL参数
    const response = await fetch(`https://api.weixin.qq.com/tcb/databaseupdate?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        env: envId,
        query: query
      })
    });
    
    const result = await response.json();
    
    if (result.errcode === 0) {
      return {
        success: true,
        matched: result.matched || 0,
        modified: result.modified || 0,
        id: result.id
      };
    } else {
      throw new Error(`微信云数据库错误 ${result.errcode}: ${result.errmsg}`);
    }
    
  } catch (error) {
    console.error('微信云数据库更新错误:', error.message);
    throw error;
  }
}

// 更新计数
app.post("/api/count", async (req, res) => {
  const { action } = req.body;
  if (action === "inc") {
    await Counter.create();
  } else if (action === "clear") {
    await Counter.destroy({
      truncate: true,
    });
  }
  res.send({
    code: 0,
    data: await Counter.count(),
  });
 });

// 获取计数
app.get("/api/count", async (req, res) => {
  const result = await Counter.count();
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID
app.get("/api/wx_openid", async (req, res) => {
  if (req.headers["x-wx-source"]) {
    res.send(req.headers["x-wx-openid"]);
  }
});

const port = process.env.PORT || 80;

async function bootstrap() {
  await initDB();
  app.listen(port, () => {
    console.log("启动成功", port);
  });
}

bootstrap();
