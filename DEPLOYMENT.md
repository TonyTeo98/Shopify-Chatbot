# 🚀 Deployment Guide

## Architecture: Frontend/Backend Separation

**This project uses a separated deployment model:**

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Frontend (Theme Extension) │     │   Backend (API Server)      │
│                              │     │                              │
│  - Shopify Theme App         │     │  - React Router + Claude    │
│  - Liquid Templates          │     │  - PostgreSQL Database      │
│  - Client JavaScript         │     │  - MCP Client               │
│  - UI Configuration          │     │  - SSE Streaming            │
│                              │     │                              │
│  Deploy: Shopify CLI         │     │  Deploy: Docker Compose     │
│  Command: npm run deploy     │     │  Command: docker-compose up │
└──────────────┬───────────────┘     └──────────────┬──────────────┘
               │                                    │
               ↓                                    ↓
     Shopify Partner Dashboard            Cloud Server (AWS/GCP/etc)
               ↓                                    ↓
        Theme Editor UI                      API Endpoint
      (Persona Selector)              (https://chatbot.ytz.me/chat)
```

---

## ⚠️ CRITICAL: Two Separate Deployments Required

### When You Modify Frontend Files

**Files:**
- `extensions/chat-bubble/blocks/*.liquid`
- `extensions/chat-bubble/assets/*.js`
- `extensions/chat-bubble/assets/*.css`
- Liquid schema configuration (persona selector, welcome message)

**Deploy Command:**
```bash
npm run deploy
```

**Result:**
- Updates Shopify Theme Editor configuration
- Merchants see new UI options (persona selector, etc.)
- Chat widget UI updates

### When You Modify Backend Files

**Files:**
- `app/routes/*.jsx`
- `app/services/*.js`
- `app/prompts/*.json`
- `prisma/schema.prisma`

**Deploy Command:**
```bash
docker-compose up -d --build
```

**Result:**
- Backend API updates
- New system prompts take effect
- MCP tools and conversation logic updates

---

## 📋 Quick Deployment Checklist

### For This Ridge Persona Update

✅ **Backend Changes:**
- `app/prompts/prompts.json` - Added ridgeAssistant
- `app/services/config.server.js` - Changed default to ridgeAssistant
- `app/routes/chat.jsx` - Fixed duplicate tool calls

**Deploy:** `docker-compose up -d --build` on cloud server

✅ **Frontend Changes:**
- `extensions/chat-bubble/blocks/chat-interface.liquid` - Added Ridge to persona selector

**Deploy:** `npm run deploy` (Shopify CLI)

---

## 🔄 Complete Deployment Workflow

### Step 1: Local Development

```bash
# Make your changes
vim app/prompts/prompts.json
vim extensions/chat-bubble/blocks/chat-interface.liquid

# Commit changes
git add .
git commit -m "feat: add Ridge persona"
git push origin main
```

### Step 2: Deploy Backend (Cloud Server)

```bash
# SSH to cloud server
ssh your-server

# Navigate to project
cd /path/to/Shopify-Chatbot

# Pull latest code
git pull origin main

# Deploy backend
docker-compose up -d --build

# Verify deployment
docker-compose logs -f app | head -50
curl -I https://chatbot.ytz.me/chat

# Check for errors
docker-compose ps
```

### Step 3: Deploy Frontend (Shopify CLI)

```bash
# Can be run from local machine OR cloud server
# (wherever Shopify CLI is configured)

cd /path/to/Shopify-Chatbot

# Ensure logged in
shopify whoami

# Deploy Theme Extension
npm run deploy

# Expected output:
# ✓ Building extensions...
# ✓ Deploying extensions...
# ✓ Deployed to development store
# ✓ Extension: chat-bubble (version X.X.X)

# Verify
shopify app info
```

### Step 4: Verify in Shopify Admin

```bash
1. Login to Shopify Admin
2. Go to: Online Store → Themes → Customize
3. Click: Add section/block → Apps → AI Chat Assistant
4. Look for: "AI Assistant Personality" dropdown
5. Verify: "Ridge - Snowboard Specialist (Recommended)" is listed
6. Select Ridge and save
7. Test chat functionality
```

---

## 📊 Deployment Decision Matrix

| What Changed? | Deploy Backend? | Deploy Frontend? | Commands |
|---------------|----------------|------------------|----------|
| System prompts | ✅ Yes | ❌ No | `docker-compose up -d --build` |
| Chat logic | ✅ Yes | ❌ No | `docker-compose up -d --build` |
| MCP tools | ✅ Yes | ❌ No | `docker-compose up -d --build` |
| Database schema | ✅ Yes | ❌ No | `docker-compose up -d --build` + migrations |
| Liquid templates | ❌ No | ✅ Yes | `npm run deploy` |
| JavaScript (chat.js) | ❌ No | ✅ Yes | `npm run deploy` |
| CSS styling | ❌ No | ✅ Yes | `npm run deploy` |
| Theme schema | ❌ No | ✅ Yes | `npm run deploy` |
| Persona selector | ❌ No | ✅ Yes | `npm run deploy` |
| **Both backend & frontend** | ✅ Yes | ✅ Yes | **Both commands required!** |

---

## 🛠️ Backend Deployment (Docker)

### Prerequisites

```bash
# On cloud server
docker --version
docker-compose --version
git --version
```

### Commands

```bash
# Full rebuild
docker-compose up -d --build

# Restart without rebuild
docker-compose restart app

# View logs
docker-compose logs -f app

# Check status
docker-compose ps

# Stop all services
docker-compose down

# Remove volumes (DANGER: deletes database!)
docker-compose down -v
```

### Environment Variables

Ensure these are set on the cloud server:

```bash
# Required
CLAUDE_API_KEY=sk-ant-xxx
SHOPIFY_API_KEY=xxx
SHOPIFY_API_SECRET=xxx
DATABASE_URL=postgresql://user:pass@postgres:5432/db

# Optional
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
CLAUDE_BASE_URL=https://api.anthropic.com
```

### Troubleshooting

```bash
# Database connection issues
docker-compose logs postgres
docker-compose exec postgres psql -U shopify -d shopify_chat -c "SELECT 1"

# Backend not responding
docker-compose logs app | tail -100
docker-compose exec app curl localhost:3000/chat -I

# Rebuild from scratch
docker-compose down
docker system prune -a
docker-compose up -d --build
```

---

## 🎨 Frontend Deployment (Shopify CLI)

### Prerequisites

```bash
# Install Shopify CLI globally
npm install -g @shopify/cli

# Or use npx (no install needed)
npx @shopify/cli version

# Login to Shopify
shopify auth login
# Follow browser OAuth flow
```

### Link Your App (First Time Only)

```bash
cd /path/to/Shopify-Chatbot

# Link to Shopify Partner app
shopify app config link

# Select your app from the list
# This creates/updates shopify.app.toml
```

### Deploy Commands

```bash
# Standard deploy
npm run deploy

# Force deploy (bypass cache)
shopify app deploy --force

# Deploy specific extension
shopify app deploy --extension=chat-bubble

# Verbose output for debugging
shopify app deploy --verbose

# Reset and deploy (if corrupted)
shopify app deploy --reset
```

### Verify Deployment

```bash
# Check app info
shopify app info

# Output should show:
# ├─ Name: Convoease (or your app name)
# ├─ Client ID: xxx
# └─ Extensions:
#    └─ chat-bubble (Theme App Extension)
#       └─ Version: X.X.X

# List extensions
shopify extension list
```

### Troubleshooting

```bash
# Not logged in
shopify auth login

# Wrong account
shopify auth logout
shopify auth login

# Build failures
rm -rf node_modules/.cache
rm -rf .shopify
npm run deploy

# Extension not showing
shopify app deploy --force --reset

# Check extension in Partner Dashboard
# Visit: https://partners.shopify.com
# Apps → Your App → Extensions
```

---

## 🧪 Testing After Deployment

### Backend Tests

```bash
# 1. Health check
curl https://chatbot.ytz.me/chat -I
# Expected: HTTP/1.1 400 Bad Request (SSE endpoint)

# 2. Test with SSE request
curl -N -H "Accept: text/event-stream" \
     -H "Content-Type: application/json" \
     -H "X-Shopify-Shop-Id: SHOP_ID" \
     -X POST \
     -d '{"message":"test","conversation_id":"test"}' \
     https://chatbot.ytz.me/chat

# 3. Check Langfuse dashboard
# Visit: https://us.cloud.langfuse.com
# Verify: New traces appear with ridgeAssistant

# 4. Database check
docker-compose exec app npm run prisma studio
# Visit: http://localhost:5555
# Check: Conversations and Messages tables
```

### Frontend Tests

```bash
# 1. Open Theme Editor
# URL: https://SHOP.myshopify.com/admin/themes/current/editor

# 2. Add Chat Block
# Click "Add block" → Apps → AI Chat Assistant

# 3. Verify Persona Selector
# Settings panel should show:
# AI Assistant Personality
# ├─ Ridge - Snowboard Specialist (Recommended)
# ├─ Enthusiastic Assistant
# └─ Standard Assistant

# 4. Test Chat Functionality
# - Select Ridge persona
# - Save and preview
# - Open chat widget
# - Send: "show me snowboards"
# - Verify: Ridge responds and calls search_shop_catalog

# 5. Check Browser Console
# F12 → Console
# Should see: WebSocket/EventSource connections
# No JavaScript errors
```

---

## 🔁 Rollback Procedures

### Backend Rollback

```bash
# Find previous working commit
git log --oneline -10

# Rollback code
git checkout <commit-hash>

# Or revert last commit
git revert HEAD

# Redeploy
docker-compose up -d --build
```

### Frontend Rollback

```bash
# Rollback code
git checkout <commit-hash> extensions/

# Redeploy extension
npm run deploy

# Merchants can also manually change persona in Theme Editor
# No code deployment needed for configuration changes
```

---

## 📞 Common Deployment Scenarios

### Scenario 1: Adding New Persona

**Files to modify:**
1. Backend: `app/prompts/prompts.json` - Add new persona prompt
2. Frontend: `extensions/chat-bubble/blocks/chat-interface.liquid` - Add to schema options

**Deploy:**
```bash
# Backend
docker-compose up -d --build

# Frontend
npm run deploy
```

### Scenario 2: Fixing Tool Calling Bug

**Files to modify:**
1. Backend: `app/routes/chat.jsx` or `app/services/mcp-client.js`

**Deploy:**
```bash
# Backend only
docker-compose up -d --build

# Frontend: Not needed
```

### Scenario 3: Updating Chat UI Styling

**Files to modify:**
1. Frontend: `extensions/chat-bubble/assets/chat.css`

**Deploy:**
```bash
# Frontend only
npm run deploy

# Backend: Not needed
```

### Scenario 4: Database Schema Change

**Files to modify:**
1. Backend: `prisma/schema.prisma`

**Deploy:**
```bash
# Create migration
npm run prisma migrate dev --name add_new_field

# Deploy backend
docker-compose up -d --build

# Migration runs automatically on startup
```

---

## 🎯 Quick Reference

### Backend Deploy (Cloud Server)

```bash
ssh your-server
cd /path/to/Shopify-Chatbot
git pull origin main
docker-compose up -d --build
docker-compose logs -f app
```

### Frontend Deploy (Any Machine with Shopify CLI)

```bash
cd /path/to/Shopify-Chatbot
git pull origin main
npm run deploy
shopify app info
```

### Both Deployments (Sequential)

```bash
# 1. Backend first
ssh your-server "cd /path/to/Shopify-Chatbot && git pull && docker-compose up -d --build"

# 2. Then frontend
cd /path/to/Shopify-Chatbot
git pull
npm run deploy
```

---

## 📚 Additional Resources

- **CLAUDE.md** - Full project architecture and development guide
- **README.md** - Project overview and setup
- **RIDGE-PERSONA.md** - Ridge persona design documentation
- **PERSONA-SWITCH-GUIDE.md** - How personas work and how to switch them

---

**Last Updated:** 2025-12-10
**Version:** 1.0
**Author:** Claude Code
