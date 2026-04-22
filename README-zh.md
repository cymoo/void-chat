# VOID.CHAT

[English README](./README.md)

VOID.CHAT 是一个实时聊天室应用，采用终端风格界面，并内置了常用的管理与协作能力。它适合希望快速搭建社区聊天、私聊和基础运营体系的团队。

![VOID.CHAT 首页占位图](./docs/images/placeholder-hero.png)

> 以上为占位符，后续可替换为真实截图。

## 核心特性

- **实时通信**：房间聊天与私聊都基于 WebSocket。
- **可运营可管理**：平台角色、房间角色、禁言/禁用、邀请链接。
- **消息体验完整**：回复、@ 提及、搜索、编辑/删除、未读提醒。
- **支持媒体内容**：图片与文件上传（有大小限制）。
- **风格鲜明**：终端 / brutalist 视觉，同时兼顾移动端可用性。

## 亮点展示

![房间界面占位图](./docs/images/placeholder-room.png)
![管理后台占位图](./docs/images/placeholder-admin.png)
![移动端占位图](./docs/images/placeholder-mobile.png)

## 本地运行

### 1) 准备依赖

- Java 21+
- Maven 3.9+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 2) 启动后端

```bash
cd backend
cp .env.example .env
make run
```

后端默认地址：`http://localhost:8000`

### 3) 启动前端

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

前端默认地址：`http://localhost:5173`，会代理 `/api`、`/chat`、`/uploads` 到后端。

### 4) 开始使用

打开 `http://localhost:5173`，注册账号后即可创建或加入房间。

## 部署指引（生产）

1. 准备 PostgreSQL 与 Redis 实例。
2. 构建后端 JAR：
   ```bash
   cd backend
   make build
   ```
3. 构建前端静态资源：
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   npm run build
   ```
4. 启动后端：
   ```bash
   java -jar backend/target/void-chat-*.jar
   ```
5. 使用 Nginx/CDN 托管 `frontend/dist`，并将 `/api`、`/chat`、`/uploads` 反向代理到后端服务。

更多环境变量和部署细节见后端文档。

## 详细文档入口

- **后端细节**：[backend/README.md](./backend/README.md)
- **前端细节**：[frontend/README.md](./frontend/README.md)

## 许可证

[MIT](./LICENSE)
