const { Sequelize, DataTypes } = require("sequelize");

// 数据库配置
const sequelize = new Sequelize("django_demo", "popa", "7h5k122u!", {
  host: "10.9.111.253",
  port: 3306,
  dialect: "mysql",
  logging: false, // 关闭SQL日志
  dialectOptions: {
    connectTimeout: 5000, // 连接超时5秒
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 5000,
    idle: 10000
  }
});

// 定义数据模型
const Counter = sequelize.define("Counter", {
  count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
});

// 定义用户表模型
const AdminUser = sequelize.define("AdminUser", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(32), // 32位MD5
    allowNull: false,
  },
}, {
  tableName: 'admin-users', // 指定表名
  timestamps: false, // 不自动添加createdAt和updatedAt字段
});

// 数据库初始化方法
async function init() {
  try {
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步表结构
    await Counter.sync({ alter: true });
    await AdminUser.sync({ alter: true });
    await PrintTask.sync({ alter: true });
    console.log('数据库表同步完成');
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    console.log('将使用模拟模式运行，登录功能可能受限');
    // 不抛出错误，让应用继续运行
  }
}

// 导出初始化方法和模型
module.exports = {
  init,
  Counter,
  AdminUser,
  PrintTask,
};
