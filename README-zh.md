# VOID.CHAT

[English README](./README.md)

VOID.CHAT 是一个实时聊天平台，采用终端风格界面，提供房间聊天、私聊与管理能力。它面向希望「快速上线、可控运营、可自部署」的社区与团队。

![VOID.CHAT 首页占位图](./docs/images/placeholder-hero.png)

> 以上为占位符，后续可替换为真实截图。

## 核心特性

- **实时通信**：房间聊天与私聊都基于 WebSocket。
- **可运营可管理**：平台角色、房间角色、禁言/禁用、邀请链接。
- **消息体验完整**：回复、@ 提及、搜索、编辑/删除、未读提醒。
- **支持媒体内容**：图片与文件上传（有大小限制）。
- **可邀请“虚拟名人”**：支持将可配置的 AI 人设邀请进房间互动。
- **风格鲜明**：终端 / brutalist 视觉，同时兼顾移动端可用性。

## 亮点展示

![房间界面占位图](./docs/images/placeholder-room.png)
![管理后台占位图](./docs/images/placeholder-admin.png)
![移动端占位图](./docs/images/placeholder-mobile.png)

### 面向真实运营场景

- 可创建公开或私密房间，支持人数上限与房间内角色管理。
- 可切换邀请制注册，便于做分阶段开放。
- 管理后台集中处理角色、禁言/禁用、邀请链接等常用操作。
- 同时满足实时沟通和可回溯消息检索的需求。

### 人设互动能力

你可以在房间里邀请 AI 人设（如“虚拟名人”）参与互动，用于主题社区、角色扮演、互动问答等场景；同时仍可沿用同一套房间权限与管理机制。

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
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`，会代理 `/api`、`/chat`、`/uploads` 到后端。

### 4) 开始使用

打开 `http://localhost:5173`，注册账号后即可创建或加入房间。

## 部署指引（生产）

### 方式 A — Docker Compose（推荐）

一条命令启动全部服务：

```bash
# 1. 克隆仓库
git clone <repo-url> && cd void-chat

# 2. 创建环境配置文件
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，至少设置 DB_PASSWORD 和 INIT_ADMIN_PASSWORD

# 3. 构建镜像并启动所有服务
docker compose -f deploy/docker-compose.yml up -d --build
```

将依次启动四个服务：**PostgreSQL**、**Redis**、**后端**（Kotlin）、**前端**（nginx）。  
应用默认监听 `http://localhost`（可通过 `deploy/.env` 中的 `HTTP_PORT` 调整端口）。

**常用命令：**
```bash
docker compose -f deploy/docker-compose.yml logs -f backend    # 实时查看后端日志
docker compose -f deploy/docker-compose.yml restart backend    # 修改配置后重启后端
docker compose -f deploy/docker-compose.yml down -v            # 停止并删除数据卷（⚠ 会清空数据）
```

> **数据库迁移** — Flyway 在后端启动时自动执行，无需手动操作。

> **Persona 引擎** — 在 `deploy/.env` 中填写 `PERSONA_LLM_API_KEY` 即可启用 LLM 机器人功能。

### 方式 B — 手动部署

1. 准备 PostgreSQL 与 Redis 实例。
2. 构建后端 JAR：
   ```bash
   cd backend
   make build
   ```
3. 构建前端静态资源：
   ```bash
   cd frontend
   npm install
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
