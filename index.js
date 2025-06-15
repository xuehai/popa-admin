const path = require("path");
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, AdminUser, PrintTask } = require("./db");

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
      console.log("微信云数据库查询失败，返回模拟数据:", wxError.message);
      
      // 生成模拟数据
      const mockData = [];
      const statuses = ['pending', 'printing', 'completed', 'failed'];
      const totalMockItems = 15;
      
      for (let i = 1; i <= totalMockItems; i++) {
        const mockItem = {
          _id: `mock_${i.toString().padStart(3, '0')}`,
          print_code: `P${(Date.now() + i).toString().slice(-6)}`,
          status: statuses[i % statuses.length],
          user_id: `user_${i.toString().padStart(3, '0')}`,
          create_time: new Date(Date.now() - (i * 3600000)).toISOString() // 每个任务间隔1小时
        };
        
        // 如果有搜索条件，过滤数据
        if (!search || mockItem.print_code.toLowerCase().includes(search.toLowerCase())) {
          mockData.push(mockItem);
        }
      }
      
      // 分页处理
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = mockData.slice(startIndex, endIndex);
      
      res.json({
        code: 0,
        data: {
          list: paginatedData,
          total: mockData.length,
          page: page,
          pageSize: pageSize,
          totalPages: Math.ceil(mockData.length / pageSize)
        },
        message: "模拟数据模式 - 微信云数据库连接失败"
      });
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
async function queryWxCloudDatabase({ page, pageSize, search }) {
  const axios = require('axios');
  
  // 微信云开发配置（需要配置实际的值）
  const WX_CLOUD_CONFIG = {
    appId: 'wx61291ca2978a97ec',
    appSecret: 'd58b4cc3f0590637de173fbaf4cd8d2d',
    env: 'art-fans-cloud-8gk5o7dr7f4b9545'
  };
  
  try {
    // 1. 获取access_token
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
    
    const accessToken = tokenResponse.data.access_token;
    
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
      env: WX_CLOUD_CONFIG.env,
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
