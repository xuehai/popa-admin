const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter, AdminUser } = require("./db");

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
