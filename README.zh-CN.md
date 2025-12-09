# Convoease

### 面向 Shopify 的 AI 客服助手

[English](README.md) | **简体中文**

<p align="center">
  <img src="https://img.shields.io/badge/Claude-AI%20Powered-blueviolet?style=flat-square&logo=anthropic" alt="Claude AI" />
  <img src="https://img.shields.io/badge/Shopify-MCP%20Integrated-green?style=flat-square&logo=shopify" alt="Shopify MCP" />
  <img src="https://img.shields.io/badge/React%20Router-v7-blue?style=flat-square&logo=react" alt="React Router" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
</p>

## 简介

Convoease 是一个面向生产环境的 Shopify AI 客服助手。顾客可通过自然语言对话完成商品搜索、购物车管理、订单查询及店铺政策咨询等操作，由 Claude AI 提供智能响应。

本项目基于 [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) 开发，针对生产环境进行了全面增强。

## 新增功能（相比原项目）

| 功能 | 原项目 | 本项目 |
|------|--------|--------|
| **LLM 可观测性** | - | 集成 Langfuse 与 OpenTelemetry 实现完整追踪 |
| **对话持久化** | - | 完整的对话历史存储至 PostgreSQL 数据库 |
| **Docker 容器化** | - | 完整的 Docker Compose 生产级部署配置 |
| **自定义 API 代理** | - | 支持通过 `CLAUDE_BASE_URL` 配置 API 代理服务 |
| **多提示词系统** | - | 可配置的 AI 人格模式（标准模式/热情模式） |
| **CORS 功能增强** | - | 支持 Private Network Access 请求头 |
| **客户身份认证持久化** | - | OAuth 令牌存储至数据库并自动续期 |
| **生产环境配置管理** | - | 基于环境变量的完整配置体系 |

## 架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                        在线店铺页面                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      主题扩展组件                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ 聊天气泡    │  │  对话窗口   │  │ 商品展示卡片        │  │   │
│  │  │  (切换)     │  │   (界面)    │  │ (卡片/链接)         │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ SSE 实时推送
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Router 后端服务                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    /chat 聊天接口                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ SSE 流式    │  │ 身份验证    │  │ 对话管理器          │  │   │
│  │  │  传输服务   │  │   处理      │  │                     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      核心服务层                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Claude    │  │  工具调用   │  │     MCP 客户端      │  │   │
│  │  │   AI 服务   │  │    服务     │  │ (店铺+客户双通道)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────────┐     ┌─────────────────┐
│  Claude AI  │      │   PostgreSQL    │     │   Shopify MCP   │
│  (Anthropic)│      │   (Prisma ORM)  │     │     服务器      │
└─────────────┘      └─────────────────┘     └─────────────────┘
```

### 组件说明

这个应用包含两个核心组件：

1. **后端服务器**：基于 React Router 开发，负责对接 Claude AI、执行工具调用、通过 SSE 实时推送对话内容。
2. **主题扩展**：Shopify 主题扩展 (`extensions/chat-bubble/`)，为用户提供聊天窗口界面。

> **重要提示**：Docker 只部署后端服务，主题扩展需要通过 Shopify CLI 单独部署。

### 数据流程

1. **用户输入** → 在聊天窗口输入消息
2. **SSE 连接** → 前端通过 SSE 连接到 `/chat` 接口
3. **AI 处理** → 将消息和历史记录发送给 Claude
4. **工具调用** → Claude 通过 JSON-RPC 调用 MCP 工具
5. **MCP 执行** → Shopify MCP 服务器返回结果
6. **实时推送** → 结果实时推送回前端
7. **数据持久化** → 对话记录保存到 PostgreSQL

## MCP 工具集成

这个应用接入了 Shopify 的 MCP（模型上下文协议）服务：

### 可用工具

| 工具名 | 功能说明 | 需要身份认证 |
|------|----------|-------------|
| `search_shop_catalog` | 搜索店铺商品目录 | 否 |
| `get_cart` | 获取当前购物车内容 | 否 |
| `update_cart` | 添加或移除购物车商品 | 否 |
| `search_shop_policies_and_faqs` | 检索店铺政策和常见问题 | 否 |
| `get_most_recent_order_status` | 获取最近订单状态 | 是 |
| `get_order_status` | 获取指定订单详情 | 是 |

### MCP 工作原理

```javascript
// MCP 客户端连接两个 API 端点
Storefront MCP: {shop}/api/mcp                              // 公共工具（无需认证）
Customer MCP:   {shop}.account.shopify.com/customer/api/mcp // 客户工具（需要认证）
```

MCP 客户端 (`app/mcp-client.js`) 实现以下功能：
- 通过 `tools/list` 端点动态发现可用工具
- 使用 JSON-RPC 2.0 协议进行通信
- 为客户工具自动注入 Authorization 请求头
- 根据工具类型自动路由至对应端点

### 使用示例

```
"你好"                                 → AI 自由对话（可自定义提示词）
"搜索滑雪板产品"                        → search_shop_catalog
"将此滑雪板添加至购物车"                 → update_cart + 生成结账链接
"查看购物车内容"                        → get_cart
"贵店支持哪些语言？"                    → search_shop_policies_and_faqs
"查询我的最近订单"                      → get_most_recent_order_status
"查询订单 ID 为 1 的详细信息"           → get_order_status
```

## 技术栈

### 前端技术
| 技术 | 版本 | 用途 |
|------|------|------|
| React Router | v7.9.1 | 全栈 Web 框架 |
| Vanilla JavaScript | - | SSE 实时通信与聊天 UI |
| CSS | - | 基于 Shopify Polaris 设计令牌 |
| Liquid | - | 主题扩展模板引擎 |

### 后端技术
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 20.10 | JavaScript 运行时 |
| Anthropic SDK | v0.40.0 | Claude API 客户端 |
| Prisma | v6.2.1 | 数据库 ORM 层 |
| PostgreSQL | 16 | 关系型数据库 |

### 可观测性
| 技术 | 版本 | 用途 |
|------|------|------|
| Langfuse | v3.38.6 | LLM 性能追踪与分析 |
| OpenTelemetry | v0.208.0 | 分布式追踪 |

### 运维工具
| 技术 | 用途 |
|------|------|
| Docker | 应用容器化 |
| Docker Compose | 多容器编排 |
| Vite v6 | 前端构建工具 |
| ESLint + Prettier | 代码规范检查与格式化 |

## 快速开始

### 准备工作

- **Node.js** >= 20.10
- **Shopify Partner 账号** - [注册地址](https://partners.shopify.com/)
- **Shopify 开发商店** - 从 Partner Dashboard 创建
- **Claude API 密钥** - 从 [Anthropic Console](https://console.anthropic.com/) 获取
- **Shopify CLI** - 用于开发环境调试和主题扩展部署
- **PostgreSQL 16+** - 本地安装或 Docker 部署

### 步骤 1：创建 Shopify 应用

1. **登录 [Shopify Partners](https://partners.shopify.com/)**
2. 点击 **Apps** → **Create app** → **Create app manually**
3. 输入应用名称（例如 "AI Chat Assistant"）
4. **保存 Client ID 和 Client Secret** - 后续步骤需要使用

### 步骤 2：安装 Shopify CLI

```bash
npm install -g @shopify/cli @shopify/app
```

验证安装：
```bash
shopify version
```

### 步骤 3：克隆仓库并配置

```bash
# 克隆代码仓库
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# 安装项目依赖
npm install

# 进行 Shopify 身份验证
shopify auth login
```

### 步骤 4：关联应用配置

```bash
# 关联到 Partner Dashboard 中创建的应用
shopify app config link
```

按照命令行提示完成以下操作：
1. 选择您的组织
2. 选择步骤 1 中创建的应用

此命令将自动更新 `shopify.app.toml` 配置文件中的 `client_id` 字段。

### 步骤 5：配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# Shopify 应用凭证
SHOPIFY_API_KEY=<从_Partner_Dashboard_获取>
SHOPIFY_API_SECRET=<从_Partner_Dashboard_获取>

# Claude API 配置
CLAUDE_API_KEY=sk-ant-xxx

# 数据库连接（本地开发环境）
DATABASE_URL=postgresql://shopify:shopify123@localhost:5432/shopify_chat

# 可选：API 代理服务
CLAUDE_BASE_URL=https://your-proxy.com

# 可选：LLM 可观测性配置
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 步骤 6：初始化数据库

**方式 A：使用本地 PostgreSQL**
```bash
# 确保 PostgreSQL 服务已启动，然后执行
npm run setup
```

**方式 B：使用 Docker PostgreSQL**
```bash
# 仅启动数据库容器
docker-compose up -d postgres

# 执行数据库初始化
npm run setup
```

### 步骤 7：启动开发服务器

```bash
npm run dev
```

此命令将执行以下操作：
- 启动 React Router 后端服务
- 创建 Cloudflare 隧道以提供公网 HTTPS 访问
- **自动部署主题扩展**到开发商店
- 在浏览器中打开应用安装页面

按照浏览器提示完成以下步骤：
1. 选择您的开发商店
2. 安装应用到商店
3. 授予应用所需权限

### 步骤 8：激活聊天组件

应用安装完成后：

1. 进入开发商店后台：**在线商店** → **主题**
2. 点击当前激活主题的 **自定义** 按钮
3. 在主题编辑器中：
   - 选择任意页面（如首页）
   - 点击 **添加分区** 或 **添加区块**
   - 在 **应用** 类别中找到 **Chat Interface**
   - 选择该组件
4. 点击 **保存**

此时访问商店前台，即可看到聊天气泡组件。

## 生产环境部署

生产环境部署需要完成以下三个步骤：

### 1. 部署后端服务

**方式 A：Docker Compose 部署（推荐）**

```bash
# 在生产服务器上执行
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# 创建生产环境配置文件
cp .env.production.example .env
# 编辑 .env 文件，配置生产环境参数

# 启动所有服务
docker-compose up -d

# 查看运行日志
docker-compose logs -f app
```

后端服务将监听 `http://your-server:8401` 端口

**方式 B：手动部署**

```bash
# 构建生产版本
npm run build

# 使用进程管理器启动（如 PM2）
npm install -g pm2
pm2 start npm --name "shopify-chat" -- start
```

### 2. 部署主题扩展

```bash
# 部署到生产环境
npm run deploy
```

按照提示完成以下操作：
1. 选择 **Production** 环境
2. 选择 **Create new version**
3. 确认部署

> **注意**：主题扩展需独立部署，每次部署将在 Partner Dashboard 中创建新版本。

### 3. 更新 Partner Dashboard 配置

1. 打开 **Partner Dashboard** → **Apps** → 选择您的应用
2. 更新 **App URL**：`https://your-production-domain.com`
3. 更新 **Allowed redirection URL(s)**：
   - `https://your-production-domain.com/api/auth`
   - `https://your-production-domain.com/api/auth/callback`
4. 在 **Customer account API** 配置中：
   - 添加 redirect URI：`https://your-production-domain.com/callback`
5. 保存配置

### 4. 启用 Customer Account API

为支持订单查询功能：

1. 在 **Partner Dashboard** → 您的应用 → **Configuration**
2. 启用 **Customer Account API**
3. 添加以下权限（已在 `shopify.app.toml` 中预配置）：
   - `customer_read_customers`
   - `customer_read_orders`
   - `customer_read_store_credit_account_transactions`
   - `customer_read_store_credit_accounts`

### 5. 安装至生产商店

1. 从 Partner Dashboard 生成应用安装链接
2. 在您的生产 Shopify 商店上安装该应用
3. 在主题编辑器中激活聊天组件（参考步骤 8）

## 环境变量参考

| 变量 | 必需 | 说明 | 示例 |
|------|------|------|------|
| `SHOPIFY_API_KEY` | ✅ | 应用 Client ID | 从 Partner Dashboard 获取 |
| `SHOPIFY_API_SECRET` | ✅ | 应用 Client Secret | 从 Partner Dashboard 获取 |
| `SHOPIFY_APP_URL` | ✅ | 应用公网访问地址 | `https://your-domain.com` |
| `CLAUDE_API_KEY` | ✅ | Anthropic API 密钥 | `sk-ant-xxx` |
| `DATABASE_URL` | ✅ | PostgreSQL 数据库连接字符串 | `postgresql://user:pass@host:5432/db` |
| `CLAUDE_BASE_URL` | ❌ | Claude API 代理服务地址 | `https://proxy.com` |
| `LANGFUSE_PUBLIC_KEY` | ❌ | Langfuse 项目公钥 | `pk-lf-xxx` |
| `LANGFUSE_SECRET_KEY` | ❌ | Langfuse 项目私钥 | `sk-lf-xxx` |
| `LANGFUSE_BASE_URL` | ❌ | Langfuse 服务端点 | `https://us.cloud.langfuse.com` |

## 项目结构

```
├── app/
│   ├── routes/
│   │   ├── chat.jsx              # 主聊天接口（SSE 流式传输）
│   │   ├── auth.callback.jsx     # OAuth 回调处理器
│   │   └── app._index.jsx        # 管理界面
│   ├── services/
│   │   ├── claude.server.js      # Claude API 服务封装
│   │   ├── tool.server.js        # MCP 工具执行服务
│   │   └── streaming.server.js   # SSE 流式传输工具
│   ├── mcp-client.js             # MCP 协议客户端实现
│   └── prompts/prompts.json      # AI 系统提示词配置
├── extensions/
│   └── chat-bubble/              # Shopify 主题扩展
│       ├── blocks/chat-interface.liquid
│       └── assets/{chat.js,chat.css}
├── prisma/
│   └── schema.prisma             # 数据库模型定义
├── docker-compose.yml            # 多容器编排配置
├── Dockerfile                    # 生产环境容器镜像
└── shopify.app.toml             # Shopify 应用配置
```

## 自定义配置

### 自定义 AI 提示词

编辑 `app/prompts/prompts.json` 文件可修改 AI 助手行为：

```json
{
  "standard": {
    "system": "在此处编写您的自定义系统提示词..."
  }
}
```

### 自定义聊天组件 UI

修改 `extensions/chat-bubble/` 目录下的文件：
- `blocks/chat-interface.liquid` - 组件 HTML 结构
- `assets/chat.css` - 样式表
- `assets/chat.js` - 前端 JavaScript 逻辑

修改后重新部署：
```bash
npm run deploy
```

### 更换 LLM 模型

在 `app/services/claude.server.js` 中修改模型配置：
```javascript
const MODEL = "claude-sonnet-4-5-20250929"; // 更换为任意 Claude 模型
```

## 数据库表结构

```prisma
model Session {
  id          String   @id
  shop        String
  state       String
  isOnline    Boolean  @default(false)
  accessToken String
  expires     DateTime?
}

model Conversation {
  id        String    @id
  messages  Message[]
  createdAt DateTime  @default(now())
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String   @db.Text
  createdAt      DateTime @default(now())
}

model CustomerToken {
  id             String   @id
  conversationId String
  accessToken    String
  refreshToken   String?
  expiresAt      DateTime
}

model CustomerAccountUrls {
  conversationId   String   @id
  mcpApiUrl        String
  authorizationUrl String
  tokenUrl         String
}
```

## 故障排查

### "无法连接到 MCP 服务器"

可能原因及解决方案：
- 确认开发商店中已添加商品数据
- 验证应用已成功安装至商店
- 检查 `SHOPIFY_APP_URL` 环境变量是否与实际访问地址一致

### 主题扩展未显示

排查步骤：
- 重新执行 `npm run dev` 以重新部署扩展
- 在主题编辑器中检查：**添加分区** → **应用** 类别
- 确认应用已成功安装至商店

### 数据库连接失败

排查步骤：
- 验证 PostgreSQL 服务正在运行
- 检查 `DATABASE_URL` 连接字符串格式是否正确
- 执行 `npm run setup` 初始化数据库架构

### OAuth 回调错误

排查步骤：
- 在 Partner Dashboard 中更新重定向 URL 配置
- 确保 URL 配置完全匹配（注意尾部斜杠）
- 验证 `SHOPIFY_APP_URL` 环境变量配置正确

## 开发环境 vs 生产环境

| 项目 | 开发环境 | 生产环境 |
|------|---------|---------|
| **服务器启动** | `npm run dev`（Shopify CLI + Cloudflare 隧道） | Docker Compose 或手动部署至 VPS |
| **数据库** | 本地 PostgreSQL 或 Docker 容器 | 托管数据库服务（如 Railway、Supabase） |
| **主题扩展部署** | 执行 `npm run dev` 时自动部署 | 需手动执行 `npm run deploy` |
| **访问 URL** | 动态生成的隧道地址 | 固定生产域名 |
| **HTTPS 证书** | Cloudflare 隧道自动提供 | 需独立配置（如 Let's Encrypt） |

## 许可证

MIT

---

## 参考资料

- [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) - 原始参考实现
- [Shopify MCP 文档](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent) - 构建 Storefront AI 助手
- [Anthropic Claude API](https://docs.anthropic.com/) - Claude API 文档
- [Langfuse](https://langfuse.com/) - LLM 可观测性平台
