# 🚀 Quick Deployment Reference

## ⚠️ CRITICAL: Two Separate Deployments Required!

```
┌─────────────────────────┐    ┌─────────────────────────┐
│  Frontend (Shopify)     │    │  Backend (Docker)       │
├─────────────────────────┤    ├─────────────────────────┤
│  • Theme Extension      │    │  • React Router API     │
│  • Chat UI              │    │  • Claude Integration   │
│  • Persona Selector     │    │  • PostgreSQL Database  │
│  • Welcome Message      │    │  • MCP Client           │
├─────────────────────────┤    ├─────────────────────────┤
│  Deploy Command:        │    │  Deploy Command:        │
│  npm run deploy         │    │  docker-compose up -d   │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 🎯 Current Status (Ridge Persona Update)

### ✅ What's Been Done

**Git Commits:**
1. `9ad4701` - Fix duplicate tool calls
2. `37db208` - Add Ridge persona with MCP integration
3. `cf51653` - Add Ridge to Theme Editor selector
4. `74efb34` - Add persona switching guide
5. `52828d2` - Clarify deployment architecture

**Files Modified:**
- ✅ Backend: `app/routes/chat.jsx` (duplicate tool call fix)
- ✅ Backend: `app/prompts/prompts.json` (Ridge persona)
- ✅ Backend: `app/services/config.server.js` (default to Ridge)
- ✅ Frontend: `extensions/chat-bubble/blocks/chat-interface.liquid` (persona selector)
- ✅ Docs: `CLAUDE.md`, `DEPLOYMENT.md`, `README.md`, etc.

**Code Pushed to Git:**
- ✅ All commits pushed to `origin/main`

### ⚠️ What Still Needs Deployment

**Backend Deployment (Cloud Server):**
```bash
# Status: NOT DEPLOYED
# Need to run:
ssh your-server
cd /path/to/Shopify-Chatbot
git pull origin main
docker-compose up -d --build
```

**Frontend Deployment (Shopify CLI):**
```bash
# Status: NOT DEPLOYED
# Need to run:
cd /path/to/Shopify-Chatbot
npm run deploy
```

---

## 📝 Deployment Checklist

### Step 1: Backend Deployment (Required)

```bash
# SSH to cloud server
ssh your-server

# Navigate and pull
cd /path/to/Shopify-Chatbot
git pull origin main

# Verify latest commit
git log --oneline -1
# Should show: 52828d2 docs: clarify frontend/backend separation architecture

# Deploy backend
docker-compose up -d --build

# Wait ~30 seconds, then verify
docker-compose logs app | tail -30

# Should see:
# ✅ Langfuse observability enabled
# ✓ Connecting to MCP server at...
# ✓ Connected to MCP with 5 tools
```

**What This Updates:**
- ✅ Ridge persona becomes available in backend
- ✅ Duplicate tool call prevention active
- ✅ MAX_TURNS reduced to 10
- ✅ System prompts with MCP tool guidance

**What Merchants Will Notice:**
- ❌ Theme Editor dropdown STILL shows old options
- ❌ Ridge not selectable yet (needs frontend deploy!)

---

### Step 2: Frontend Deployment (Required)

```bash
# Can run from local machine OR cloud server
# (wherever Shopify CLI is configured)

cd /path/to/Shopify-Chatbot

# Ensure logged in
shopify whoami

# Deploy Theme Extension
npm run deploy

# Expected output:
# ✓ Building extensions...
# ✓ Deploying extensions...
# ✓ Deployed extension: chat-bubble

# Verify
shopify app info
```

**What This Updates:**
- ✅ Theme Editor dropdown shows Ridge option
- ✅ Welcome message updated to Ridge style
- ✅ Persona selector shows "Recommended" label

**What Merchants Will Notice:**
- ✅ "Ridge - Snowboard Specialist (Recommended)" appears in dropdown
- ✅ Can select and test Ridge persona
- ✅ Chat works with new personality

---

### Step 3: Verification

**Backend Health Check:**
```bash
# Test API endpoint
curl -I https://chatbot.ytz.me/chat

# Check recent logs
docker-compose logs app | grep -E "(Ridge|Tool call|Duplicate)" | tail -20

# Verify Langfuse traces (optional)
# Visit: https://us.cloud.langfuse.com
# Look for: ridgeAssistant in recent traces
```

**Frontend Verification:**
```bash
# 1. Open Shopify Admin
# URL: https://YOUR_SHOP.myshopify.com/admin

# 2. Go to Theme Editor
# Online Store → Themes → Customize

# 3. Find Chat Block
# Add block → Apps → AI Chat Assistant

# 4. Check Settings Panel
# Should show:
# ┌─────────────────────────────────────────┐
# │ AI Assistant Personality                │
# ├─────────────────────────────────────────┤
# │ [v] Ridge - Snowboard Specialist (Rec..│ ← NEW!
# │ [ ] Enthusiastic Assistant              │
# │ [ ] Standard Assistant                  │
# └─────────────────────────────────────────┘
```

**End-to-End Test:**
```bash
# 5. Select Ridge and Save
# 6. Preview store
# 7. Open chat widget
# 8. Send: "show me snowboards"

# Expected Response:
# - Ridge introduces himself
# - Calls search_shop_catalog tool
# - Presents products naturally
# - Uses snowboarding terminology

# Check logs:
docker-compose logs app | tail -50
# Should see:
# 🔧 Tool call #1: search_shop_catalog
# 📊 Turn 1 Summary:
#    Stop Reason: tool_use
#    Unique Tools Used: 1
```

---

## 📊 What Each Deployment Does

| Deployment | Updates | Doesn't Update |
|------------|---------|----------------|
| **Backend Only** (Docker) | • System prompts<br>• Conversation logic<br>• Tool calling behavior<br>• Database schema | ❌ Theme Editor dropdown<br>❌ Persona selector options<br>❌ Welcome message defaults |
| **Frontend Only** (Shopify CLI) | • Theme Editor UI<br>• Persona selector<br>• Welcome message<br>• Chat widget styling | ❌ AI behavior<br>❌ Tool calling<br>❌ System prompts |
| **Both** (Complete) | ✅ Everything works!<br>• Ridge selectable in Theme Editor<br>• Ridge behavior in conversations | N/A |

---

## ⚡ Quick Commands

### Backend Deploy (Cloud Server)
```bash
ssh your-server "cd /path/to/Shopify-Chatbot && git pull && docker-compose up -d --build"
```

### Frontend Deploy (Any Machine with Shopify CLI)
```bash
cd /path/to/Shopify-Chatbot && git pull && npm run deploy
```

### Both Deployments (Sequential)
```bash
# 1. Backend
ssh your-server "cd /path/to/Shopify-Chatbot && git pull && docker-compose up -d --build"

# 2. Wait ~30 seconds for backend to stabilize

# 3. Frontend
cd /path/to/Shopify-Chatbot && git pull && npm run deploy
```

---

## 🐛 Troubleshooting

### "Theme Editor doesn't show Ridge option"
**Problem:** Only deployed backend, forgot frontend
**Solution:** Run `npm run deploy`

### "Ridge selected but behavior is old"
**Problem:** Only deployed frontend, forgot backend
**Solution:** Run `docker-compose up -d --build` on server

### "Shopify CLI not logged in"
```bash
shopify auth login
# Follow browser OAuth flow
```

### "Docker containers not starting"
```bash
# Check logs
docker-compose logs app

# Restart fresh
docker-compose down
docker-compose up -d --build
```

---

## 📚 Documentation

- **DEPLOYMENT.md** - Complete deployment guide (400+ lines)
- **CLAUDE.md** - Project architecture and development
- **RIDGE-PERSONA.md** - Ridge persona design
- **PERSONA-SWITCH-GUIDE.md** - How personas work
- **README.md** - Project overview

---

**Last Updated:** 2025-12-10 (after commit 52828d2)
**Status:** Code ready, awaiting deployment
**Next Step:** Deploy backend, then frontend
