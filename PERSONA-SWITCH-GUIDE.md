# 🎨 AI人设切换指南

## ✅ 回答你的问题

**问：切换人设是不是需要重构前端app，或者在前端选择人设？**

**答：不需要重构！** 你的项目已经有完整的人设切换功能，而且实现得非常优雅。

---

## 🏗️ 现有架构

### 切换流程

```
Shopify Theme Editor (商家后台)
  ↓ 选择人设
Liquid Schema (chat-interface.liquid)
  ↓ 渲染配置
window.shopChatConfig.promptType
  ↓ JavaScript读取
前端 chat.js 发送 prompt_type 参数
  ↓ HTTP请求
后端 chat.jsx 接收
  ↓ 传递给Claude
Claude API 使用对应的系统提示词
```

### 核心文件

1. **Liquid模板** (`extensions/chat-bubble/blocks/chat-interface.liquid`)
   ```liquid
   <script>
     window.shopChatConfig = {
       promptType: {{ block.settings.system_prompt | json }},
       welcomeMessage: {{ block.settings.welcome_message | json }}
     };
   </script>

   {% schema %}
   {
     "settings": [
       {
         "type": "select",
         "id": "system_prompt",
         "options": [...]
       }
     ]
   }
   {% endschema %}
   ```

2. **前端JavaScript** (`extensions/chat-bubble/assets/chat.js`)
   ```javascript
   const promptType = window.shopChatConfig?.promptType || "standardAssistant";
   const requestBody = JSON.stringify({
     message: userMessage,
     conversation_id: conversationId,
     prompt_type: promptType  // ← 发送给后端
   });
   ```

3. **后端路由** (`app/routes/chat.jsx`)
   ```javascript
   const promptType = body.prompt_type || AppConfig.api.defaultPromptType;
   // ↓ 传递给Claude服务
   await claudeService.streamConversation({
     messages: conversationHistory,
     promptType,  // ← 使用对应的提示词
     tools: mcpClient.tools
   }, ...)
   ```

4. **提示词配置** (`app/prompts/prompts.json`)
   ```json
   {
     "systemPrompts": {
       "ridgeAssistant": { "content": "..." },
       "enthusiasticAssistant": { "content": "..." },
       "standardAssistant": { "content": "..." }
     }
   }
   ```

---

## 🎯 最新更新

### 已完成的修改

#### 1. 添加Ridge人设到选择器

**文件**: `extensions/chat-bubble/blocks/chat-interface.liquid`

```liquid
{
  "type": "select",
  "id": "system_prompt",
  "label": "AI Assistant Personality",
  "info": "Choose the personality and style of your AI assistant",
  "options": [
    {
      "value": "ridgeAssistant",
      "label": "Ridge - Snowboard Specialist (Recommended)"
    },
    {
      "value": "enthusiasticAssistant",
      "label": "Enthusiastic Assistant"
    },
    {
      "value": "standardAssistant",
      "label": "Standard Assistant"
    }
  ],
  "default": "ridgeAssistant"
}
```

#### 2. 更新默认欢迎消息

```liquid
{
  "type": "text",
  "id": "welcome_message",
  "label": "Welcome Message",
  "default": "🏂 Hey! Ridge here. Looking for a new board or have questions about gear? I'm here to help you find the perfect setup!"
}
```

---

## 📱 商家如何切换人设

### 在Shopify后台操作

1. **进入Theme Editor**
   - Shopify Admin → Online Store → Themes
   - 点击 "Customize"

2. **添加/编辑聊天模块**
   - 点击页面任意位置
   - 左侧面板点击 "Add section" 或 "Add block"
   - 选择 "Apps" → "AI Chat Assistant"

3. **配置AI人设**
   - 在左侧面板找到 "AI Assistant Personality"
   - 下拉选择：
     - **Ridge - Snowboard Specialist (Recommended)** ✅ 推荐
     - Enthusiastic Assistant
     - Standard Assistant

4. **自定义欢迎消息**（可选）
   - 在 "Welcome Message" 字段修改
   - 默认会根据选择的人设自动匹配

5. **保存并发布**
   - 点击右上角 "Save"
   - 点击 "Publish"

### 预览效果

商家可以在Theme Editor中实时预览不同人设的效果。

---

## 🚀 部署流程

### 步骤1：推送代码到云服务器

```bash
# 本地已完成（刚才执行）
git push origin main
```

### 步骤2：云服务器更新

SSH到云服务器：

```bash
# 进入项目目录
cd /path/to/Shopify-Chatbot

# 拉取最新代码
git pull origin main

# 重新部署（会重新构建Theme Extension）
npm run deploy

# 或者如果使用Docker
docker-compose up -d --build
```

### 步骤3：Shopify同步

Theme Extension会自动同步到Shopify：
- `npm run deploy` 会推送到Shopify
- 商家在Theme Editor中看到新的人设选项

---

## 🎭 可用的人设

### 1. Ridge - Snowboard Specialist (推荐) 🏂

**特点**:
- 10年滑雪经验的专业顾问
- 深入了解滑雪板技术规格
- 主动调用MCP工具搜索产品
- 自然融合专业知识和亲切服务

**适合场景**:
- 滑雪板店铺（当前）
- 运动装备店
- 需要专业技术咨询的产品

**语言风格**:
```
"Nice! What's your riding style looking like?"
"That board's got a medium flex - perfect for progressing from intermediate"
"I rode something similar last season at Whistler - handles powder like a dream"
```

### 2. Enthusiastic Assistant (热情型) 🎉

**特点**:
- 名字：Zara
- 热情洋溢、充满活力
- 使用感叹号和积极的语气
- 善于营造愉快的购物氛围

**适合场景**:
- 时尚服饰
- 美妆护肤
- 面向年轻消费者的品牌

**语言风格**:
```
"Absolutely! I'd love to help with that!"
"That's a fantastic choice!"
"This is going to be perfect for you!"
```

### 3. Standard Assistant (标准型) 👔

**特点**:
- 通用助手，无特定人设
- 专业友好的标准服务
- 适合任何类型的店铺

**适合场景**:
- 多品类综合店
- B2B业务
- 偏好低调风格的品牌

**语言风格**:
```
"How can I help you today?"
"Here are some options that might work for you"
"Let me check what we have available"
```

---

## 🔧 高级配置

### 动态切换（可选）

如果需要根据用户行为动态切换人设，可以修改JavaScript：

```javascript
// 在 chat.js 中
function getPersonalityForUser(userContext) {
  // 例如：根据用户浏览的产品类型
  if (userContext.viewedSnowboards) {
    return "ridgeAssistant";
  }
  // 默认
  return window.shopChatConfig?.promptType || "standardAssistant";
}

// 发送消息时使用
const promptType = getPersonalityForUser(currentUserContext);
```

### URL参数切换（测试用）

可以通过URL参数临时测试不同人设：

```
https://yourstore.com/?chat_persona=ridgeAssistant
```

在 `chat.js` 中添加：

```javascript
const urlParams = new URLSearchParams(window.location.search);
const testPersona = urlParams.get('chat_persona');
const promptType = testPersona || window.shopChatConfig?.promptType || "standardAssistant";
```

---

## 📊 监控建议

部署后，监控以下指标来评估人设效果：

### Langfuse指标
- **工具调用率**: Ridge是否主动调用search_shop_catalog
- **对话轮次**: 平均完成咨询需要几轮
- **响应质量**: 客户是否得到满意的推荐

### 业务指标
- **转化率**: 从聊天到添加购物车的比例
- **平均订单价值**: 不同人设下的AOV对比
- **客户反馈**: 人设是否与品牌调性匹配

### A/B测试建议

可以分流测试：
- 50%用户使用Ridge
- 50%用户使用Standard
- 对比7天的转化数据

---

## 🎯 总结

### 核心优势

✅ **无需前端开发** - 商家在Shopify后台即可切换
✅ **实时生效** - 保存后立即应用到所有对话
✅ **灵活扩展** - 添加新人设只需修改2个文件
✅ **统一体验** - 每个人设配套提示词、欢迎语、语言风格

### 架构亮点

1. **配置驱动** - 通过Liquid Schema配置，无需硬编码
2. **前后端分离** - 前端传参数，后端选择提示词
3. **商家友好** - 可视化配置界面，无需技术知识
4. **开发高效** - 新增人设只需：
   - `prompts.json` 添加提示词
   - `chat-interface.liquid` 添加选项
   - 推送部署即可

### 下一步

如果需要更多人设类型，可以参考 `RIDGE-PERSONA.md` 中的设计框架：
- 明确身份和专长
- 定义语言风格
- 配置MCP工具触发条件
- 设计对话流程示例

---

**版本**: 1.0
**更新日期**: 2025-12-10
**作者**: Claude Code
