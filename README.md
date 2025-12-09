# Convoease

### AI-Powered Customer Service Assistant for Shopify

[简体中文](README.zh-CN.md) | **English**

<p align="center">
  <img src="https://img.shields.io/badge/Claude-AI%20Powered-blueviolet?style=flat-square&logo=anthropic" alt="Claude AI" />
  <img src="https://img.shields.io/badge/Shopify-MCP%20Integrated-green?style=flat-square&logo=shopify" alt="Shopify MCP" />
  <img src="https://img.shields.io/badge/React%20Router-v7-blue?style=flat-square&logo=react" alt="React Router" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
</p>

## Introduction

Convoease is a production-ready AI-powered customer service assistant for Shopify storefronts. Shoppers can search products, manage carts, track orders, and get answers about store policies — all through natural conversation with Claude AI.

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
| `get_most_recent_order_status` | Get most recent order status | Yes (Customer) |
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
"what languages does your store support?"  → search_shop_policies_and_faqs
"Show me my recent orders"              → get_most_recent_order_status
"details about order Id 1"              → get_order_status
```

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React Router | v7.9.1 | Full-stack web framework |
| Vanilla JS | - | SSE streaming and chat UI |
| CSS | - | Styling with Shopify Polaris tokens |
| Liquid | - | Theme extension templating |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | >= 20.10 | JavaScript runtime |
| Anthropic SDK | v0.40.0 | Claude API client |
| Prisma | v6.2.1 | Database ORM |
| PostgreSQL | 16 | Persistent storage |

### Observability
| Technology | Version | Purpose |
|------------|---------|---------|
| Langfuse | v3.38.6 | LLM observability and tracing |
| OpenTelemetry | v0.208.0 | Distributed tracing |

### DevOps
| Technology | Purpose |
|------------|---------|
| Docker | Application containerization |
| Docker Compose | Multi-container orchestration |
| Vite v6 | Frontend build tooling |
| ESLint + Prettier | Code linting and formatting |

## Getting Started

### Prerequisites

- **Node.js** >= 20.10
- **Shopify Partner account** - [Sign up here](https://partners.shopify.com/)
- **Shopify development store** - Created from Partner Dashboard
- **Claude API key** - Get from [Anthropic Console](https://console.anthropic.com/)
- **Shopify CLI** - For local development and extension deployment
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

Production deployment requires three steps:

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

To enable order tracking functionality:

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
│   │   ├── chat.jsx              # Main chat endpoint with SSE streaming
│   │   ├── auth.callback.jsx     # OAuth callback handler
│   │   └── app._index.jsx        # Admin interface
│   ├── services/
│   │   ├── claude.server.js      # Claude API service wrapper
│   │   ├── tool.server.js        # MCP tool execution service
│   │   └── streaming.server.js   # SSE streaming utilities
│   ├── mcp-client.js             # MCP protocol client implementation
│   └── prompts/prompts.json      # AI system prompt configurations
├── extensions/
│   └── chat-bubble/              # Shopify theme extension
│       ├── blocks/chat-interface.liquid
│       └── assets/{chat.js,chat.css}
├── prisma/
│   └── schema.prisma             # Database schema definition
├── docker-compose.yml            # Multi-container orchestration config
├── Dockerfile                    # Production container image
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
| **Server** | `npm run dev` (Shopify CLI + tunnel) | Docker Compose / VPS deployment |
| **Database** | Local PostgreSQL or Docker | Managed PostgreSQL (e.g., Railway, Supabase) |
| **Extension** | Auto-deployed with `npm run dev` | Manual deployment via `npm run deploy` |
| **URLs** | Dynamic tunnel URL | Static production domain |
| **SSL** | Provided by Cloudflare tunnel | Required (e.g., Let's Encrypt) |

## License

MIT

---

## References

- [Shopify/shop-chat-agent](https://github.com/Shopify/shop-chat-agent) - Original reference implementation
- [Shopify MCP Documentation](https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent) - Build a Storefront AI agent
- [Anthropic Claude API](https://docs.anthropic.com/) - Claude API documentation
- [Langfuse](https://langfuse.com/) - LLM observability platform
