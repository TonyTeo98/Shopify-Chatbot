# Shopify AI Chat Agent / Shopify AI 聊天助手

<p align="center">
  <img src="https://img.shields.io/badge/Claude-AI%20Powered-blueviolet?style=flat-square&logo=anthropic" alt="Claude AI" />
  <img src="https://img.shields.io/badge/Shopify-MCP%20Integrated-green?style=flat-square&logo=shopify" alt="Shopify MCP" />
  <img src="https://img.shields.io/badge/React%20Router-v7-blue?style=flat-square&logo=react" alt="React Router" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
</p>

---

**English** | [中文](#中文文档)

## Introduction

A production-ready AI-powered chat widget for Shopify storefronts. Shoppers can search products, manage carts, track orders, and get answers about store policies — all through natural conversation with Claude AI.

This project is based on [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) with significant enhancements for production deployment.

## What's New (vs Original)

| Feature | Original | This Fork |
|---------|----------|-----------|
| **LLM Observability** | - | Langfuse integration with OpenTelemetry tracing |
| **Conversation Persistence** | - | Full conversation history stored in PostgreSQL |
| **Docker Deployment** | - | Complete Docker Compose setup with PostgreSQL |
| **Custom API Proxy** | - | Support for `CLAUDE_BASE_URL` to use API proxies |
| **Multi-Prompt System** | - | Configurable AI personalities (Standard/Enthusiastic) |
| **CORS Enhancement** | - | Private Network Access header support |
| **Customer Auth Persistence** | - | OAuth tokens stored in database with auto-renewal |
| **Production Config** | - | Environment-based configuration management |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shopify Storefront                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Theme Extension                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ Chat Bubble │  │  Chat UI    │  │ Product Display     │  │   │
│  │  │  (Toggle)   │  │  (Window)   │  │ (Cards/Links)       │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ SSE Stream (Server-Sent Events)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Router Backend                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    /chat Endpoint                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Streaming │  │    Auth     │  │ Conversation        │  │   │
│  │  │   Service   │  │   Handler   │  │ Manager             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Core Services                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Claude    │  │    Tool     │  │     MCP Client      │  │   │
│  │  │   Service   │  │   Service   │  │ (Storefront+Customer│  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────────┐     ┌─────────────────┐
│  Claude AI  │      │   PostgreSQL    │     │   Shopify MCP   │
│  (Anthropic)│      │   (Prisma ORM)  │     │    Servers      │
└─────────────┘      └─────────────────┘     └─────────────────┘
                                                     │
                            ┌────────────────────────┼────────────────────────┐
                            ▼                        ▼                        ▼
                     ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
                     │  Storefront │          │  Customer   │          │    Cart     │
                     │  Catalog    │          │  Account    │          │  Checkout   │
                     └─────────────┘          └─────────────┘          └─────────────┘
```

### Components

This app consists of two main components:

1. **Backend Server**: A React Router app that handles Claude AI communication, MCP tool execution, and chat streaming via Server-Sent Events (SSE).
2. **Theme Extension**: A Shopify theme extension (`extensions/chat-bubble/`) that provides the customer-facing chat widget.

> **Important**: Docker deployment handles the backend server only. The theme extension must be deployed separately via Shopify CLI.

### Data Flow

1. **User Input** → Chat UI captures message
2. **SSE Request** → Frontend streams to `/chat` endpoint
3. **Claude Processing** → Message sent to Claude with conversation history
4. **Tool Calls** → Claude invokes MCP tools via JSON-RPC
5. **MCP Execution** → Shopify MCP servers return results
6. **Response Stream** → Results streamed back to frontend
7. **Persistence** → Conversation saved to PostgreSQL

## MCP Tools Integration

This app integrates with Shopify's Model Context Protocol (MCP) servers:

### Available Tools

| Tool | Description | Auth Required |
|------|-------------|---------------|
| `search_shop_catalog` | Search products by query | No |
| `get_cart` | Retrieve current cart contents | No |
| `update_cart` | Add/remove items from cart | No |
| `search_shop_policies_and_faqs` | Find store policies | No |
| `get_most_recent_order_status` | Get recent orders | Yes (Customer) |
| `get_order_status` | Get specific order details | Yes (Customer) |

### MCP Architecture

```javascript
// MCP Client connects to dual endpoints
Storefront MCP: {shop}/api/mcp           // Public tools
Customer MCP:   {shop}.account.shopify.com/customer/api/mcp  // Authenticated tools
```

The MCP client (`app/mcp-client.js`) handles:
- Dynamic tool discovery via `tools/list`
- JSON-RPC 2.0 protocol communication
- Authorization header injection for customer tools
- Automatic endpoint routing based on tool type

### Usage Examples

```
"hi"                                    → LLM response (customizable prompt)
"can you search for snowboards"         → search_shop_catalog
"add The Videographer Snowboard"        → update_cart + checkout URL
"what is in my cart"                    → get_cart
"what languages is your store in?"      → search_shop_policies_and_faqs
"Show me my recent orders"              → get_most_recent_order_status
"details about order Id 1"              → get_order_status
```

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React Router | v7.9.1 | Full-stack framework |
| Vanilla JS | - | Chat UI with SSE |
| CSS | - | Shopify Polaris tokens |
| Liquid | - | Theme extension templates |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | >= 20.10 | Runtime |
| Anthropic SDK | v0.40.0 | Claude API |
| Prisma | v6.2.1 | Database ORM |
| PostgreSQL | 16 | Data persistence |

### Observability
| Technology | Version | Purpose |
|------------|---------|---------|
| Langfuse | v3.38.6 | LLM tracing |
| OpenTelemetry | v0.208.0 | Telemetry |

### DevOps
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Orchestration |
| Vite v6 | Build tool |
| ESLint + Prettier | Code quality |

## Getting Started

### Prerequisites

- **Node.js** >= 20.10
- **Shopify Partner account** - [Sign up here](https://partners.shopify.com/)
- **Shopify development store** - Created from Partner Dashboard
- **Claude API key** - Get from [Anthropic Console](https://console.anthropic.com/)
- **Shopify CLI** - For local development and deployment
- **PostgreSQL 16+** - Local install or Docker

### Step 1: Create Shopify App

1. **Log in to [Shopify Partners](https://partners.shopify.com/)**
2. Click **Apps** → **Create app** → **Create app manually**
3. Enter app name (e.g., "AI Chat Assistant")
4. **Save the Client ID and Client Secret** - you'll need these later

### Step 2: Install Shopify CLI

```bash
npm install -g @shopify/cli @shopify/app
```

Verify installation:
```bash
shopify version
```

### Step 3: Clone and Configure

```bash
# Clone repository
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# Install dependencies
npm install

# Authenticate with Shopify
shopify auth login
```

### Step 4: Link App Configuration

```bash
# Link to your Partner app
shopify app config link
```

When prompted:
1. Select your organization
2. Choose the app you created in Step 1

This will update `shopify.app.toml` with your app's `client_id`.

### Step 5: Configure Environment Variables

Create `.env` file in project root:

```bash
# Shopify App Credentials
SHOPIFY_API_KEY=<from_partner_dashboard>
SHOPIFY_API_SECRET=<from_partner_dashboard>

# Claude API
CLAUDE_API_KEY=sk-ant-xxx

# Database (for local development)
DATABASE_URL=postgresql://shopify:shopify123@localhost:5432/shopify_chat

# Optional: API Proxy (for regions with restricted access)
CLAUDE_BASE_URL=https://your-proxy.com

# Optional: LLM Observability
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Step 6: Database Setup

**Option A: Local PostgreSQL**
```bash
# Ensure PostgreSQL is running, then:
npm run setup
```

**Option B: Docker PostgreSQL**
```bash
# Start only the database container
docker-compose up -d postgres

# Then run setup
npm run setup
```

### Step 7: Start Development Server

```bash
npm run dev
```

This command will:
- Start the React Router backend
- Create a Cloudflare tunnel for public HTTPS access
- **Automatically deploy the theme extension** to your dev store
- Open your browser to install the app

Follow the prompts to:
1. Select your development store
2. Install the app
3. Grant required permissions

### Step 8: Activate Chat Widget

After installing the app:

1. Go to your dev store **Admin** → **Online Store** → **Themes**
2. Click **Customize** on your active theme
3. In the theme editor:
   - Navigate to any page (e.g., homepage)
   - Click **Add section** or **Add block**
   - Find **"Apps"** section
   - Select **"Chat Interface"** (from your app)
4. **Save** the theme

Now visit your storefront - you should see the chat bubble!

## Deployment to Production

Production deployment requires three components:

### 1. Backend Server Deployment

**Option A: Docker Compose (Recommended)**

```bash
# On your server (e.g., VPS, cloud instance)
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# Create production .env
cp .env.production.example .env
# Edit .env with production credentials

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app
```

The backend will be available at `http://your-server:8401`

**Option B: Manual Deployment**

```bash
# Build the app
npm run build

# Start with process manager (e.g., PM2)
npm install -g pm2
pm2 start npm --name "shopify-chat" -- start
```

### 2. Theme Extension Deployment

```bash
# Deploy extension to production
npm run deploy
```

When prompted:
1. Select **Production** environment
2. Choose **Create new version**
3. Confirm deployment

> **Note**: Extensions are deployed separately from the backend. Each deployment creates a new version in the Partner Dashboard.

### 3. Update App URLs in Partner Dashboard

1. Go to **Partner Dashboard** → **Apps** → Your app
2. Update **App URL**: `https://your-production-domain.com`
3. Update **Allowed redirection URL(s)**:
   - `https://your-production-domain.com/api/auth`
   - `https://your-production-domain.com/api/auth/callback`
4. In **Customer account API** section:
   - Add redirect URI: `https://your-production-domain.com/callback`
5. Save changes

### 4. Enable Customer Account API

For order tracking features to work:

1. In Partner Dashboard → Your app → **Configuration**
2. Enable **Customer Account API**
3. Add required scopes (already in `shopify.app.toml`):
   - `customer_read_customers`
   - `customer_read_orders`
   - `customer_read_store_credit_account_transactions`
   - `customer_read_store_credit_accounts`

### 5. Install on Production Store

1. Generate installation URL from Partner Dashboard
2. Install app on your production Shopify store
3. Activate the chat widget in Theme Editor (same as Step 8 above)

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SHOPIFY_API_KEY` | ✅ | App Client ID | From Partner Dashboard |
| `SHOPIFY_API_SECRET` | ✅ | App Client Secret | From Partner Dashboard |
| `SHOPIFY_APP_URL` | ✅ | Public app URL | `https://your-domain.com` |
| `CLAUDE_API_KEY` | ✅ | Anthropic API key | `sk-ant-xxx` |
| `DATABASE_URL` | ✅ | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `CLAUDE_BASE_URL` | ❌ | Claude API proxy | `https://proxy.com` |
| `LANGFUSE_PUBLIC_KEY` | ❌ | Langfuse project key | `pk-lf-xxx` |
| `LANGFUSE_SECRET_KEY` | ❌ | Langfuse secret | `sk-lf-xxx` |
| `LANGFUSE_BASE_URL` | ❌ | Langfuse endpoint | `https://us.cloud.langfuse.com` |

## Project Structure

```
├── app/
│   ├── routes/
│   │   ├── chat.jsx              # Main chat endpoint (SSE)
│   │   ├── auth.callback.jsx     # OAuth callback
│   │   └── app._index.jsx        # Admin interface
│   ├── services/
│   │   ├── claude.server.js      # Claude API wrapper
│   │   ├── tool.server.js        # Tool execution
│   │   └── streaming.server.js   # SSE utilities
│   ├── mcp-client.js             # MCP protocol client
│   └── prompts/prompts.json      # AI system prompts
├── extensions/
│   └── chat-bubble/              # Theme extension
│       ├── blocks/chat-interface.liquid
│       └── assets/{chat.js,chat.css}
├── prisma/
│   └── schema.prisma             # Database schema
├── docker-compose.yml            # Container orchestration
├── Dockerfile                    # Production image
└── shopify.app.toml             # Shopify app configuration
```

## Customization

### Customize AI Prompt

Edit `app/prompts/prompts.json` to change the AI assistant's behavior:

```json
{
  "standard": {
    "system": "Your custom system prompt here..."
  }
}
```

### Customize Chat Widget UI

Edit files in `extensions/chat-bubble/`:
- `blocks/chat-interface.liquid` - Widget HTML structure
- `assets/chat.css` - Styling
- `assets/chat.js` - Frontend JavaScript

After making changes, redeploy:
```bash
npm run deploy
```

### Change LLM Model

In `app/services/claude.server.js`, modify the model:
```javascript
const MODEL = "claude-sonnet-4-5-20250929"; // Change to any Claude model
```

## Database Schema

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

## Troubleshooting

### "Failed to connect to MCP servers"
- Ensure your development store has products
- Check that the app is installed on the store
- Verify `SHOPIFY_APP_URL` matches your tunnel URL

### Theme extension not showing
- Run `npm run dev` again to redeploy
- Check Theme Editor → Add section → Apps
- Ensure app is installed on the store

### Database connection errors
- Verify PostgreSQL is running
- Check `DATABASE_URL` format
- Run `npm run setup` to initialize database

### OAuth callback errors
- Update redirect URLs in Partner Dashboard
- Ensure URLs match exactly (no trailing slashes)
- Check `SHOPIFY_APP_URL` environment variable

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Server** | `npm run dev` (Shopify CLI tunnel) | Docker/VPS with public domain |
| **Database** | Local PostgreSQL or Docker | Managed PostgreSQL (e.g., Railway, Supabase) |
| **Extension** | Auto-deployed on `npm run dev` | Manual `npm run deploy` |
| **URLs** | Dynamic tunnel URL | Static production domain |
| **SSL** | Provided by Cloudflare tunnel | Required (Let's Encrypt, etc.) |

## License

MIT

---

<a name="中文文档"></a>

# 中文文档

[English](#introduction) | **中文**

## 简介

这是一个生产就绪的 Shopify 店铺 AI 聊天助手。购物者可以通过与 Claude AI 的自然对话来搜索商品、管理购物车、追踪订单,以及获取店铺政策相关问题的解答。

本项目基于 [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) 进行开发,并针对生产环境部署做了大量增强。

## 新增功能（相比原项目）

| 功能 | 原项目 | 本项目 |
|------|--------|--------|
| **LLM 可观测性** | - | 集成 Langfuse + OpenTelemetry 追踪 |
| **会话持久化** | - | 完整对话历史存储至 PostgreSQL |
| **Docker 部署** | - | 完整的 Docker Compose 配置 |
| **自定义 API 代理** | - | 支持 `CLAUDE_BASE_URL` 使用 API 代理 |
| **多提示词系统** | - | 可配置的 AI 人格（标准/热情模式） |
| **CORS 增强** | - | 私有网络访问头支持 |
| **客户认证持久化** | - | OAuth 令牌数据库存储 + 自动续期 |
| **生产环境配置** | - | 基于环境变量的配置管理 |

## 架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shopify 店铺前端                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    主题扩展 (Theme Extension)                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │ 聊天气泡    │  │  聊天界面   │  │ 商品展示卡片        │  │   │
│  │  │  (切换)     │  │  (窗口)     │  │ (卡片/链接)         │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  │  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ SSE 流 (服务器推送事件)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      React Router 后端                              │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    /chat 接口                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   流式服务  │  │   认证处理  │  │ 会话管理器          │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    核心服务层                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │   Claude    │  │    工具     │  │     MCP 客户端      │  │   │
│  │  │   服务      │  │    服务     │  │ (店铺+客户端双通道) │  │   │
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

该应用由两个主要组件构成：

1. **后端服务器**: 基于 React Router 的应用程序,处理 Claude AI 通信、MCP 工具执行,以及通过 SSE 流式传输聊天内容。
2. **主题扩展**: Shopify 主题扩展 (`extensions/chat-bubble/`),为顾客提供聊天组件界面。

> **重要提示**: Docker 部署仅处理后端服务器。主题扩展必须通过 Shopify CLI 单独部署。

### 数据流程

1. **用户输入** → 聊天界面捕获消息
2. **SSE 请求** → 前端向 `/chat` 接口发起流式请求
3. **Claude 处理** → 消息连同对话历史发送至 Claude
4. **工具调用** → Claude 通过 JSON-RPC 调用 MCP 工具
5. **MCP 执行** → Shopify MCP 服务器返回结果
6. **响应流** → 结果流式返回至前端
7. **持久化** → 对话保存至 PostgreSQL

## MCP 工具集成

本应用集成了 Shopify 的模型上下文协议 (MCP) 服务器:

### 可用工具

| 工具 | 描述 | 需要认证 |
|------|------|----------|
| `search_shop_catalog` | 按关键词搜索商品 | 否 |
| `get_cart` | 获取当前购物车内容 | 否 |
| `update_cart` | 添加/移除购物车商品 | 否 |
| `search_shop_policies_and_faqs` | 查找店铺政策 | 否 |
| `get_most_recent_order_status` | 获取最近订单 | 是（客户认证） |
| `get_order_status` | 获取指定订单详情 | 是（客户认证） |

### MCP 架构

```javascript
// MCP 客户端连接双端点
店铺 MCP: {shop}/api/mcp                              // 公开工具
客户 MCP: {shop}.account.shopify.com/customer/api/mcp // 认证工具
```

MCP 客户端 (`app/mcp-client.js`) 负责:
- 通过 `tools/list` 动态发现工具
- JSON-RPC 2.0 协议通信
- 为客户工具注入 Authorization 头
- 根据工具类型自动路由到对应端点

### 使用示例

```
"hi"                                    → LLM 响应（可自定义提示词）
"搜索滑雪板"                             → search_shop_catalog
"把这个滑雪板加入购物车"                   → update_cart + 结账链接
"购物车里有什么"                          → get_cart
"你们店支持什么语言？"                     → search_shop_policies_and_faqs
"查看我最近的订单"                        → get_most_recent_order_status
"订单1的详细信息"                         → get_order_status
```

## 技术栈

### 前端
| 技术 | 版本 | 用途 |
|------|------|------|
| React Router | v7.9.1 | 全栈框架 |
| 原生 JS | - | SSE 聊天界面 |
| CSS | - | Shopify Polaris 设计令牌 |
| Liquid | - | 主题扩展模板 |

### 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 20.10 | 运行时 |
| Anthropic SDK | v0.40.0 | Claude API |
| Prisma | v6.2.1 | 数据库 ORM |
| PostgreSQL | 16 | 数据持久化 |

### 可观测性
| 技术 | 版本 | 用途 |
|------|------|------|
| Langfuse | v3.38.6 | LLM 链路追踪 |
| OpenTelemetry | v0.208.0 | 遥测 |

### 运维
| 技术 | 用途 |
|------|------|
| Docker | 容器化 |
| Docker Compose | 编排 |
| Vite v6 | 构建工具 |
| ESLint + Prettier | 代码质量 |

## 快速开始

### 前置条件

- **Node.js** >= 20.10
- **Shopify Partner 账户** - [在此注册](https://partners.shopify.com/)
- **Shopify 开发店铺** - 从 Partner Dashboard 创建
- **Claude API 密钥** - 从 [Anthropic Console](https://console.anthropic.com/) 获取
- **Shopify CLI** - 用于本地开发和部署
- **PostgreSQL 16+** - 本地安装或 Docker

### 步骤 1: 创建 Shopify 应用

1. **登录 [Shopify Partners](https://partners.shopify.com/)**
2. 点击 **应用** → **创建应用** → **手动创建应用**
3. 输入应用名称（例如 "AI 聊天助手"）
4. **保存 Client ID 和 Client Secret** - 稍后会用到

### 步骤 2: 安装 Shopify CLI

```bash
npm install -g @shopify/cli @shopify/app
```

验证安装:
```bash
shopify version
```

### 步骤 3: 克隆并配置项目

```bash
# 克隆仓库
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# 安装依赖
npm install

# 使用 Shopify 进行身份验证
shopify auth login
```

### 步骤 4: 链接应用配置

```bash
# 链接到你的 Partner 应用
shopify app config link
```

提示时:
1. 选择你的组织
2. 选择步骤 1 中创建的应用

这会用你的应用 `client_id` 更新 `shopify.app.toml`。

### 步骤 5: 配置环境变量

在项目根目录创建 `.env` 文件:

```bash
# Shopify 应用凭证
SHOPIFY_API_KEY=<从_partner_dashboard_获取>
SHOPIFY_API_SECRET=<从_partner_dashboard_获取>

# Claude API
CLAUDE_API_KEY=sk-ant-xxx

# 数据库（用于本地开发）
DATABASE_URL=postgresql://shopify:shopify123@localhost:5432/shopify_chat

# 可选: API 代理（用于访问受限地区）
CLAUDE_BASE_URL=https://your-proxy.com

# 可选: LLM 可观测性
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 步骤 6: 数据库设置

**方案 A: 本地 PostgreSQL**
```bash
# 确保 PostgreSQL 正在运行,然后:
npm run setup
```

**方案 B: Docker PostgreSQL**
```bash
# 仅启动数据库容器
docker-compose up -d postgres

# 然后运行设置
npm run setup
```

### 步骤 7: 启动开发服务器

```bash
npm run dev
```

此命令将:
- 启动 React Router 后端
- 创建 Cloudflare 隧道以提供公共 HTTPS 访问
- **自动将主题扩展部署**到你的开发店铺
- 打开浏览器以安装应用

按照提示:
1. 选择你的开发店铺
2. 安装应用
3. 授予所需权限

### 步骤 8: 激活聊天组件

安装应用后:

1. 前往开发店铺 **管理后台** → **在线商店** → **模板**
2. 点击活动模板的 **自定义**
3. 在模板编辑器中:
   - 导航到任何页面（例如首页）
   - 点击 **添加部分** 或 **添加区块**
   - 找到 **"应用"** 部分
   - 选择 **"Chat Interface"**（来自你的应用）
4. **保存** 模板

现在访问你的店铺 - 你应该能看到聊天气泡!

## 生产环境部署

生产环境部署需要三个组件:

### 1. 后端服务器部署

**方案 A: Docker Compose（推荐）**

```bash
# 在你的服务器上（例如 VPS、云实例）
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# 创建生产环境 .env
cp .env.production.example .env
# 编辑 .env 填入生产凭证

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

后端将在 `http://your-server:8401` 可用

**方案 B: 手动部署**

```bash
# 构建应用
npm run build

# 使用进程管理器启动（例如 PM2）
npm install -g pm2
pm2 start npm --name "shopify-chat" -- start
```

### 2. 主题扩展部署

```bash
# 部署扩展到生产环境
npm run deploy
```

提示时:
1. 选择 **Production** 环境
2. 选择 **创建新版本**
3. 确认部署

> **注意**: 扩展与后端分开部署。每次部署都会在 Partner Dashboard 中创建新版本。

### 3. 在 Partner Dashboard 中更新应用 URL

1. 前往 **Partner Dashboard** → **应用** → 你的应用
2. 更新 **应用 URL**: `https://your-production-domain.com`
3. 更新 **允许的重定向 URL**:
   - `https://your-production-domain.com/api/auth`
   - `https://your-production-domain.com/api/auth/callback`
4. 在 **Customer account API** 部分:
   - 添加重定向 URI: `https://your-production-domain.com/callback`
5. 保存更改

### 4. 启用 Customer Account API

为使订单追踪功能正常工作:

1. 在 Partner Dashboard → 你的应用 → **配置**
2. 启用 **Customer Account API**
3. 添加所需权限（已在 `shopify.app.toml` 中）:
   - `customer_read_customers`
   - `customer_read_orders`
   - `customer_read_store_credit_account_transactions`
   - `customer_read_store_credit_accounts`

### 5. 在生产店铺上安装

1. 从 Partner Dashboard 生成安装 URL
2. 在你的生产 Shopify 店铺上安装应用
3. 在模板编辑器中激活聊天组件（同上述步骤 8）

## 环境变量参考

| 变量 | 必需 | 描述 | 示例 |
|------|------|------|------|
| `SHOPIFY_API_KEY` | ✅ | 应用 Client ID | 从 Partner Dashboard 获取 |
| `SHOPIFY_API_SECRET` | ✅ | 应用 Client Secret | 从 Partner Dashboard 获取 |
| `SHOPIFY_APP_URL` | ✅ | 公开应用 URL | `https://your-domain.com` |
| `CLAUDE_API_KEY` | ✅ | Anthropic API 密钥 | `sk-ant-xxx` |
| `DATABASE_URL` | ✅ | PostgreSQL 连接 | `postgresql://user:pass@host:5432/db` |
| `CLAUDE_BASE_URL` | ❌ | Claude API 代理 | `https://proxy.com` |
| `LANGFUSE_PUBLIC_KEY` | ❌ | Langfuse 项目密钥 | `pk-lf-xxx` |
| `LANGFUSE_SECRET_KEY` | ❌ | Langfuse 私钥 | `sk-lf-xxx` |
| `LANGFUSE_BASE_URL` | ❌ | Langfuse 端点 | `https://us.cloud.langfuse.com` |

## 项目结构

```
├── app/
│   ├── routes/
│   │   ├── chat.jsx              # 主聊天接口 (SSE)
│   │   ├── auth.callback.jsx     # OAuth 回调
│   │   └── app._index.jsx        # 管理界面
│   ├── services/
│   │   ├── claude.server.js      # Claude API 封装
│   │   ├── tool.server.js        # 工具执行服务
│   │   └── streaming.server.js   # SSE 工具类
│   ├── mcp-client.js             # MCP 协议客户端
│   └── prompts/prompts.json      # AI 系统提示词
├── extensions/
│   └── chat-bubble/              # 主题扩展
│       ├── blocks/chat-interface.liquid
│       └── assets/{chat.js,chat.css}
├── prisma/
│   └── schema.prisma             # 数据库模型
├── docker-compose.yml            # 容器编排配置
├── Dockerfile                    # 生产镜像配置
└── shopify.app.toml             # Shopify 应用配置
```

## 自定义

### 自定义 AI 提示词

编辑 `app/prompts/prompts.json` 来改变 AI 助手的行为:

```json
{
  "standard": {
    "system": "在此填写你的自定义系统提示词..."
  }
}
```

### 自定义聊天组件 UI

编辑 `extensions/chat-bubble/` 中的文件:
- `blocks/chat-interface.liquid` - 组件 HTML 结构
- `assets/chat.css` - 样式
- `assets/chat.js` - 前端 JavaScript

修改后重新部署:
```bash
npm run deploy
```

### 更换 LLM 模型

在 `app/services/claude.server.js` 中修改模型:
```javascript
const MODEL = "claude-sonnet-4-5-20250929"; // 改为任何 Claude 模型
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
- 确保你的开发店铺有商品
- 检查应用是否已安装在店铺上
- 验证 `SHOPIFY_APP_URL` 与你的隧道 URL 匹配

### 主题扩展未显示
- 重新运行 `npm run dev` 以重新部署
- 检查模板编辑器 → 添加部分 → 应用
- 确保应用已安装在店铺上

### 数据库连接错误
- 验证 PostgreSQL 正在运行
- 检查 `DATABASE_URL` 格式
- 运行 `npm run setup` 来初始化数据库

### OAuth 回调错误
- 在 Partner Dashboard 中更新重定向 URL
- 确保 URL 完全匹配（无尾部斜杠）
- 检查 `SHOPIFY_APP_URL` 环境变量

## 开发 vs 生产

| 方面 | 开发 | 生产 |
|------|------|------|
| **服务器** | `npm run dev`（Shopify CLI 隧道） | Docker/VPS 配公网域名 |
| **数据库** | 本地 PostgreSQL 或 Docker | 托管 PostgreSQL（如 Railway、Supabase） |
| **扩展** | `npm run dev` 时自动部署 | 手动 `npm run deploy` |
| **URL** | 动态隧道 URL | 静态生产域名 |
| **SSL** | Cloudflare 隧道提供 | 必需（Let's Encrypt 等） |

## 许可证

MIT

---

## References / 参考资料

- [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) - Original reference implementation
- [Shopify MCP Documentation](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent) - Build a Storefront AI agent
- [Anthropic Claude API](https://docs.anthropic.com/) - Claude API documentation
- [Langfuse](https://langfuse.com/) - LLM observability platform
