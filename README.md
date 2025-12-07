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

## Deployment

### Prerequisites

- Node.js >= 20.10
- PostgreSQL 16+ (or Docker)
- Shopify Partner account
- Claude API key

### Environment Variables

```bash
# Required
SHOPIFY_API_KEY=your_app_client_id
SHOPIFY_API_SECRET=your_app_secret
SHOPIFY_APP_URL=https://your-domain.com
CLAUDE_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Optional - API Proxy
CLAUDE_BASE_URL=https://your-proxy.com

# Optional - Observability
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Option 1: Docker Compose (Recommended)

```bash
# Clone and setup
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# Configure environment
cp .env.production.example .env
# Edit .env with your credentials

# Start services
docker-compose up -d

# App available at http://localhost:8401
```

### Option 2: Local Development

```bash
# Install dependencies
npm install

# Setup database
npm run setup

# Start development server (with Shopify CLI tunneling)
npm run dev
```

### Option 3: Manual Production

```bash
# Build
npm run build

# Start with PM2 or similar
npm start
```

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
└── Dockerfile                    # Production image
```

## Database Schema

```prisma
model Conversation {
  id        String    @id
  messages  Message[]
  createdAt DateTime  @default(now())
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String
}

model CustomerToken {
  id             String   @id
  conversationId String
  accessToken    String
  refreshToken   String
  expiresAt      DateTime
}
```

## License

MIT

---

<a name="中文文档"></a>

# 中文文档

[English](#introduction) | **中文**

## 简介

这是一个生产就绪的 Shopify 店铺 AI 聊天助手。购物者可以通过与 Claude AI 的自然对话来搜索商品、管理购物车、追踪订单，以及获取店铺政策相关问题的解答。

本项目基于 [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) 进行开发，并针对生产环境部署做了大量增强。

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
│  └─────────────────────────────────────────────────────────────┘   │
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

### 数据流程

1. **用户输入** → 聊天界面捕获消息
2. **SSE 请求** → 前端向 `/chat` 接口发起流式请求
3. **Claude 处理** → 消息连同对话历史发送至 Claude
4. **工具调用** → Claude 通过 JSON-RPC 调用 MCP 工具
5. **MCP 执行** → Shopify MCP 服务器返回结果
6. **响应流** → 结果流式返回至前端
7. **持久化** → 对话保存至 PostgreSQL

## MCP 工具集成

本应用集成了 Shopify 的模型上下文协议 (MCP) 服务器：

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

MCP 客户端 (`app/mcp-client.js`) 负责：
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

## 部署方式

### 前置条件

- Node.js >= 20.10
- PostgreSQL 16+ (或使用 Docker)
- Shopify Partner 账户
- Claude API 密钥

### 环境变量

```bash
# 必需
SHOPIFY_API_KEY=你的应用客户端ID
SHOPIFY_API_SECRET=你的应用密钥
SHOPIFY_APP_URL=https://你的域名.com
CLAUDE_API_KEY=sk-ant-xxx

# 数据库
DATABASE_URL=postgresql://用户名:密码@主机:5432/数据库名

# 可选 - API 代理（国内用户推荐）
CLAUDE_BASE_URL=https://你的代理地址.com

# 可选 - 可观测性
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 方式一：Docker Compose（推荐）

```bash
# 克隆并配置
git clone https://github.com/yourusername/shopify-chatbot.git
cd shopify-chatbot

# 配置环境变量
cp .env.production.example .env
# 编辑 .env 填入你的凭证

# 启动服务
docker-compose up -d

# 应用访问地址 http://localhost:8401
```

### 方式二：本地开发

```bash
# 安装依赖
npm install

# 初始化数据库
npm run setup

# 启动开发服务器（带 Shopify CLI 隧道）
npm run dev
```

### 方式三：手动生产部署

```bash
# 构建
npm run build

# 使用 PM2 或类似工具启动
npm start
```

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
└── Dockerfile                    # 生产镜像配置
```

## 数据库表结构

```prisma
model Conversation {
  id        String    @id
  messages  Message[]
  createdAt DateTime  @default(now())
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // "user" | "assistant"
  content        String
}

model CustomerToken {
  id             String   @id
  conversationId String
  accessToken    String
  refreshToken   String
  expiresAt      DateTime
}
```

## 许可证

MIT

---

## References / 参考资料

- [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) - Original reference implementation
- [Shopify MCP Documentation](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent) - Build a Storefront AI agent
- [Anthropic Claude API](https://docs.anthropic.com/) - Claude API documentation
- [Langfuse](https://langfuse.com/) - LLM observability platform
