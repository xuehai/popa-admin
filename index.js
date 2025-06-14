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
      
      res.json({
        code: 0,
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
    let query = 'db.collection("print_tasks")';
    
    // 添加搜索条件
    if (search) {
      query += `.where({print_code: db.RegExp({regexp: "${search}", options: "i"})})`;
    }
    
    // 添加排序和分页
    const offset = (page - 1) * pageSize;
    query += `.orderBy("create_time", "desc").skip(${offset}).limit(${pageSize}).get()`;

    console.log('print tasks查询语句:', query);
    
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
    
    console.log('print tasks查询结果:', queryResponse.data.data);
    const records = JSON.parse(queryResponse.data.data);
    
    // 4. 查询总数（用于分页）
    let countQuery = 'db.collection("print_tasks")';
    if (search) {
      countQuery += `.where({print_code: db.RegExp({regexp: "${search}", options: "i"})})`;
    }
    countQuery += '.count()';
    
    const countResponse = await axios.post('https://api.weixin.qq.com/tcb/databasequery', {
      env: WX_CLOUD_CONFIG.env,
      query: countQuery
    }, {
      params: {
        access_token: accessToken
      }
    });
    
    let total = 0;
    if (countResponse.data.errcode === 0) {
      const countResult = JSON.parse(countResponse.data.data);
      total = countResult.total || 0;
    }
    
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
