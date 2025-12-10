# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Convoease** is a production-ready AI-powered customer service assistant for Shopify storefronts. It combines Claude AI with Shopify's Model Context Protocol (MCP) to enable customers to search products, manage carts, track orders, and get answers about store policies through natural conversation.

**Architecture**: Full-stack React Router v7 application with Server-Sent Events (SSE) streaming, PostgreSQL persistence, Langfuse observability, and Docker deployment.

**Based on**: Shopify/shop-chat-agent with significant production enhancements (observability, persistence, Docker support, custom API proxies, multi-prompt system).

## Development Commands

### Daily Development

```bash
# Start development server (with hot reload)
npm run dev
# Starts React Router backend on port 3000
# Vite HMR on port 64999
# Creates Cloudflare tunnel for HTTPS
# Auto-deploys theme extension to dev store

# Type checking without building
npm run typecheck

# Linting
npm run lint
```

### Database Operations

```bash
# Initial database setup (generate Prisma client + push schema)
npm run setup

# Access Prisma CLI directly
npm run prisma

# Examples:
npm run prisma migrate dev        # Create and apply migration
npm run prisma studio            # Open Prisma Studio GUI
npm run prisma db push          # Push schema without migration
```

### Building and Production

```bash
# Production build
npm run build

# Start production server (after build)
npm start

# Docker deployment (includes DB setup + server start)
npm run docker-start
```

### Shopify-Specific Commands

```bash
# Link app configuration to Partner Dashboard
npm run config:link

# Deploy theme extension to production
npm run deploy

# Generate Shopify app config
npm run generate

# Manage environment variables
npm run env

# Generate GraphQL types from Shopify API
npm run graphql-codegen
```

## Core Architecture

### Request Flow

```
Customer Message
  → Theme Extension (SSE Connection)
  → /chat Endpoint (React Router)
  → Load Conversation History (PostgreSQL)
  → Claude Service (Streaming with Langfuse Tracing)
  → Claude API (Anthropic)
  → Tool Execution (MCP Client)
  → Shopify MCP Servers (Storefront + Customer Account)
  → Response Stream (SSE)
  → Save to Database
  → Display in Chat UI
```

### Key Architectural Patterns

**Server-Driven SSE Streaming**: The application uses ReadableStream for true streaming responses with backpressure handling. All Claude responses are streamed to the frontend via Server-Sent Events.

**MCP Tool Integration**: JSON-RPC 2.0 protocol for communicating with two separate MCP endpoints:

- **Storefront MCP** (`{shop}/api/mcp`): Public catalog tools (search, cart, policies)
- **Customer Account MCP** (`{shop}.account.shopify.com/customer/api/mcp`): Authenticated tools (order status)

**PKCE Authentication Flow**: Customer authentication uses Proof Key for Code Exchange (PKCE) with code verifiers stored in PostgreSQL. OAuth tokens are persisted and automatically refreshed.

**Conversation Loop Management**: Handles multi-turn conversations with Claude (max 20 turns) to prevent infinite loops. Each turn can trigger tool use, which feeds results back to Claude for final response synthesis.

**Langfuse Observability**: OpenTelemetry integration traces every Claude API call, tool execution, and streaming performance metric (TTFT, chunk counts, thinking blocks).

## File Structure and Key Locations

### Backend Core (`/app`)

**Routes** (`/app/routes/`):

- `chat.jsx` - Main chat endpoint handling SSE streaming and conversation management
- `auth.callback.jsx` / `auth.$.jsx` / `auth.token-status.jsx` - OAuth authentication flow
- `app._index.jsx` - Admin dashboard UI
- `api.webhooks.jsx` - Shopify webhook receiver

**Services** (`/app/services/`):

- `claude.server.js` - Claude API wrapper with streaming, Langfuse tracing, custom base URL support
- `mcp-client.js` - MCP protocol client (tool discovery, JSON-RPC dispatch, dual-endpoint routing)
- `tool.server.js` - Tool execution manager (processes MCP responses, formats product cards)
- `streaming.server.js` - SSE stream creation and management
- `config.server.js` - Centralized configuration (AppConfig singleton pattern)

**Core Infrastructure**:

- `db.server.js` - Prisma client initialization and database functions
- `auth.server.js` - OAuth 2.0 PKCE implementation
- `entry.server.jsx` - React Router SSR setup
- `instrumentation.server.js` - OpenTelemetry + Langfuse initialization

**Configuration**:

- `prompts/prompts.json` - System prompts for Claude (supports multiple personalities via `prompt_type` parameter)

### Frontend (`/extensions/chat-bubble`)

**Theme Extension**:

- `blocks/chat-interface.liquid` - Shopify Liquid template for chat widget
- `assets/chat.js` - Vanilla JavaScript for SSE connection and UI handling
- `assets/chat.css` - Widget styling with Shopify Polaris tokens

### Database (`/prisma`)

**Schema Models**:

- `Session` - Shopify app session storage (online/offline tokens)
- `Conversation` - Chat session tracking
- `Message` - Individual messages with role (user/assistant)
- `CustomerToken` - OAuth tokens for customer authentication
- `CodeVerifier` - PKCE authentication state
- `CustomerAccountUrls` - Customer Account MCP endpoint URLs per conversation

## Working with Claude AI Integration

### Customizing System Prompts

Edit `app/prompts/prompts.json`:

```json
{
  "standardAssistant": {
    "system": "Your custom system prompt here..."
  },
  "enthusiasticAssistant": {
    "system": "Alternative personality..."
  }
}
```

Select prompt via `prompt_type` URL parameter or modify default in `claude.server.js`.

### Streaming Architecture

- Claude responses are streamed using `stream.on('message')` event listeners
- Langfuse spans are created for each turn with performance metrics
- Text deltas are immediately written to SSE stream
- Tool use blocks trigger MCP execution before continuing
- Thinking blocks are recorded to Langfuse (not sent to client by default)

### Tool Execution Flow

1. Claude returns `tool_use` content block with `id`, `name`, `input`
2. `mcp-client.js` dispatches to appropriate MCP endpoint (Storefront or Customer)
3. Tool result formatted as `tool_result` content block
4. Sent back to Claude with full conversation history
5. Claude synthesizes final response incorporating tool results

### Conversation History Management

- Full conversation history loaded from database on each request
- Passed to Claude with every turn (no context window management yet)
- New messages saved to database after streaming completes
- Conversation ID passed via `conversationId` URL parameter

## MCP Tool Integration

### Available MCP Tools

- `search_shop_catalog` - Product search (no auth)
- `get_cart` / `update_cart` - Cart management (no auth)
- `search_shop_policies_and_faqs` - Store policies (no auth)
- `get_most_recent_order_status` / `get_order_status` - Order tracking (customer auth required)

### Adding New Tools

1. MCP tools are discovered automatically via `tools/list` JSON-RPC call
2. Claude decides when to invoke tools based on tool descriptions
3. `mcp-client.js` handles routing to correct endpoint
4. `tool.server.js` processes responses and formats display

### MCP Client Architecture

- Connects to dual MCP endpoints on initialization
- Uses JSON-RPC 2.0 protocol for all communication
- Automatically injects customer authorization headers for authenticated tools
- Handles errors (auth_required, rate_limit, internal_error)

## Observability and Debugging

### Langfuse Integration

Configure in `.env`:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

**What Gets Traced**:

- Every Claude API call with token usage
- Tool invocations with input/output
- Streaming performance (TTFT, total time, chunk counts)
- Thinking blocks (Claude's internal reasoning)
- Multi-turn conversation loops with stop reasons

**Trace Hierarchy**:

```
chat-session (top-level span)
├── anthropic-stream (turn 1)
├── tool-searchProducts (MCP call)
├── anthropic-stream (turn 2)
└── tool-getCart (MCP call)
```

### Debugging Tips

- Check Langfuse dashboard for slow TTFT (> 500ms indicates prompt/history issues)
- Review tool execution times in Langfuse metadata
- Examine conversation rounds to detect loops (> 5 turns suggests tool definition issues)
- Use `npm run prisma studio` to inspect database state
- Check Docker logs: `docker-compose logs -f app`

### Performance Metrics Tracked

- **TTFT** (Time To First Token): Latency from request to first response chunk
- **Total Stream Time**: Complete response generation time
- **Text Chunk Count**: Number of streaming chunks sent
- **Average Chunk Interval**: Time between chunks (backpressure indicator)

## Environment Configuration

### Required Variables

```bash
# Shopify
SHOPIFY_API_KEY=<partner_dashboard_client_id>
SHOPIFY_API_SECRET=<partner_dashboard_client_secret>
SHOPIFY_APP_URL=<public_app_url>

# Claude AI
CLAUDE_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Optional Enhancements

```bash
# Custom API Proxy
CLAUDE_BASE_URL=https://your-proxy.com

# LLM Observability
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### Environment File Templates

- `.env.example` - Development template
- `.env.production.example` - Production template with additional variables

## Docker Deployment

### Services

**PostgreSQL 16**:

- Internal network only (no exposed port in production)
- Data persisted to `./data/postgres`
- Health checks configured

**Node.js Application**:

- Built from `Dockerfile` (Alpine Node.js 18)
- Exposed on port 8401 (maps to internal 3000)
- Depends on healthy PostgreSQL
- Runs database setup on startup via `npm run docker-start`

### Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart app only
docker-compose restart app

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## Testing and Development Workflow

### Local Development Setup

1. Install dependencies: `npm install`
2. Configure `.env` with Shopify and Claude credentials
3. Start database: `docker-compose up -d postgres` OR use local PostgreSQL
4. Initialize database: `npm run setup`
5. Start dev server: `npm run dev`
6. Install app on dev store (follow CLI prompts)
7. Activate theme extension in Theme Editor

### Theme Extension Development

- Extension files in `/extensions/chat-bubble/`
- Auto-deployed during `npm run dev`
- Manual deployment: `npm run deploy`
- Changes require theme refresh in browser

### Database Schema Changes

1. Modify `prisma/schema.prisma`
2. Create migration: `npm run prisma migrate dev --name description`
3. Or push directly (no migration): `npm run prisma db push`

### Testing Changes

- No automated test suite currently configured
- Manual testing via storefront chat widget
- Monitor Langfuse for AI behavior validation
- Use `test-api.js` for ad-hoc API testing

## Common Patterns and Anti-Patterns

### ✅ Best Practices

**Streaming**: Always use ReadableStream for responses. Never buffer full responses in memory.

**Database Access**: Use Prisma singleton from `db.server.js`. Never create new PrismaClient instances.

**Configuration**: Get settings from `AppConfig` in `config.server.js`. Avoid hardcoded values.

**Error Handling**: Return structured errors with types (`auth_required`, `rate_limit`, etc.) that frontend understands.

**Tool Results**: Always include `tool_use_id` in `tool_result` blocks. Claude requires this for correlation.

**MCP Communication**: Use JSON-RPC 2.0 format. Never call MCP endpoints directly via fetch.

### ❌ Anti-Patterns

**Don't**: Create conversations without initializing customer auth state first (leads to auth errors on tool use).

**Don't**: Modify `conversationId` mid-conversation (breaks history continuity).

**Don't**: Skip Langfuse tracing on errors (makes debugging impossible).

**Don't**: Send raw MCP errors to Claude (format them as tool_result errors instead).

**Don't**: Mix React Router actions with GET routes for chat (SSE requires GET with streaming).

## Shopify-Specific Considerations

### MCP Endpoint Discovery

- Storefront MCP URL is always `{shop}/api/mcp`
- Customer Account MCP URL varies per conversation (stored in `CustomerAccountUrls` table)
- Customer Account endpoints obtained during OAuth flow

### OAuth Flow

1. User requests authenticated action (e.g., "show my orders")
2. Backend generates PKCE code verifier and challenge
3. Redirect to Shopify Customer Account authorization
4. Callback receives authorization code
5. Exchange code for access token using code verifier
6. Store token in database with expiry
7. Retry original tool call with authorization header

### Session Management

- App sessions (Shopify admin) stored via `@shopify/shopify-app-session-storage-prisma`
- Customer sessions (storefront) managed separately with `CustomerToken` model
- No shared session state between admin and customer contexts

### Webhook Handling

- Webhook endpoint at `/api/webhooks`
- Must validate HMAC signature (handled by Shopify SDK)
- Process asynchronously to avoid timeouts

## Migration and Upgrade Notes

### From Original shop-chat-agent

This fork adds significant infrastructure. If migrating from the original:

1. Add PostgreSQL database and configure `DATABASE_URL`
2. Run `npm run setup` to initialize schema
3. Optional: Configure Langfuse for observability
4. Update Docker Compose if using containers
5. Theme extension is compatible (no changes needed)

### React Router v7 Conventions

- Routes in `/app/routes/` with file-based routing
- Server code in `.server.js` files (tree-shaken from client)
- Client code in `.client.js` files (never sent to server)
- Shared utilities in regular `.js` files

### Claude SDK Updates

- Currently using `@anthropic-ai/sdk` v0.40.0
- Streaming API uses event-based `message` listeners
- Tool use format is standard Anthropic API format
- Monitor changelog for breaking changes to streaming API

## Debugging Scenarios

### "MCP connection failed"

- Verify Shopify app is installed on store
- Check store has products (empty catalog fails some MCP tools)
- Ensure `SHOPIFY_APP_URL` matches current tunnel/domain

### "Customer authentication required"

- Normal for order status tools
- Frontend should handle by redirecting to auth flow
- Check `CustomerToken` table for expired tokens

### "Database connection error"

- Verify PostgreSQL is running: `docker-compose ps postgres`
- Check `DATABASE_URL` format
- Run `npm run setup` to initialize schema
- Check Docker network connectivity

### "Stream ended prematurely"

- Check Claude API key validity
- Review Langfuse for API errors
- Verify `CLAUDE_BASE_URL` if using proxy
- Check network timeouts (streams can be long for multi-turn conversations)

### "Theme extension not appearing"

- Run `npm run deploy` to deploy extension
- Activate in Theme Editor: Customize → Add block → Apps → Chat Interface
- Check browser console for JavaScript errors
- Verify Cloudflare tunnel is accessible

## Additional Resources

- **README.md** - Detailed setup, deployment, and customization guide
- **OBSERVABILITY.md** - Langfuse integration documentation (Chinese)
- **Shopify MCP Docs** - https://shopify.dev/docs/apps/build/storefront-mcp/build-storefront-ai-agent
- **Claude API Docs** - https://docs.anthropic.com/
- **React Router v7 Docs** - https://reactrouter.com/
- **Prisma Docs** - https://www.prisma.io/docs

用中文跟我对话
