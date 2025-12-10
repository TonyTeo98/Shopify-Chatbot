# 🏂 Ridge - 滑雪板店铺AI助手

## 新人设特性

### 角色定位
**Ridge** - 拥有10年滑雪经验的专业滑雪板顾问，既能提供专业建议，又能像朋友一样交流。

### 核心能力

#### ✅ MCP工具调用集成

提示词中明确定义了5个关键触发场景：

1. **产品搜索** (`search_shop_catalog`)
   - 触发词："show me boards", "looking for", "what snowboards"
   - 示例查询："beginner snowboard", "all-mountain", "powder"

2. **购物车查询** (`get_cart`)
   - 触发词："what's in my cart", "show my cart"

3. **添加到购物车** (`update_cart`)
   - 触发词："add to cart", "I want this one"
   - 需要从搜索结果获取产品ID

4. **政策查询** (`search_shop_policies_and_faqs`)
   - 触发词："return policy", "shipping", "warranty"

5. **订单追踪** (`get_order_status`)
   - 触发词:"where's my order", "track order"
   - 需要客户认证

### 关键设计亮点

#### 🎯 明确的工具调用指导

```
**CRITICAL: Tool Usage - When to Call Functions**

1. **search_shop_catalog** - ALWAYS use when:
   - Customer asks about products: 'show me boards'...
   - Example queries to pass: 'snowboard', 'all-mountain'...
```

- 使用 **ALWAYS**, **MUST**, **IMMEDIATELY** 等强调词
- 提供具体的触发词示例
- 包含对话流程示例

#### 🔄 完整的对话流程示例

```
Customer: 'I'm looking for a beginner snowboard'
You: [MUST call search_shop_catalog with query='beginner snowboard']
Then: 'Let me find some beginner-friendly boards for you... [present results]'
```

这告诉AI：
1. 识别客户意图
2. 调用什么工具
3. 如何自然地呈现结果

#### 💬 自然的语言风格

- "Nice!", "That's a solid choice"
- 分享简短的滑雪经历
- 询问技能水平和骑行偏好
- 诚实推荐，不过度推销

### 测试场景

#### 场景1：产品搜索
```
User: "I'm looking for an all-mountain board for intermediate riders"
Expected:
- AI调用 search_shop_catalog(query="all-mountain intermediate")
- 返回2-3款产品
- 每款产品突出2-3个关键特性
- 解释为什么适合中级骑手
```

#### 场景2：购物车操作
```
User: "Add The Videographer Snowboard to my cart"
Expected:
- AI调用 update_cart(variant_id=xxx)
- 确认添加成功
- 提供 checkout 链接
```

#### 场景3：政策查询
```
User: "What's your return policy?"
Expected:
- AI调用 search_shop_policies_and_faqs(query="return policy")
- 清晰呈现政策内容
```

#### 场景4：闲聊
```
User: "What's the best board for powder?"
Expected:
- AI分享一些powder riding的知识
- 然后调用 search_shop_catalog(query="powder snowboard")
- 推荐具体产品
```

### 配置更新

- **默认人设**: 从 `standardAssistant` 改为 `ridgeAssistant`
- **位置**: `app/services/config.server.js`
- **修改文件**:
  - `app/prompts/prompts.json` - 新增 ridgeAssistant
  - `app/services/config.server.js` - 更新默认值

### 部署说明

1. **提交更改**:
```bash
git add app/prompts/prompts.json app/services/config.server.js
git commit -m "feat: add Ridge snowboard specialist persona with MCP tool integration"
git push origin main
```

2. **远程部署**:
```bash
# SSH到云服务器
cd /path/to/Shopify-Chatbot
git pull origin main
docker-compose up -d --build
```

3. **验证**:
```bash
# 查看日志
docker-compose logs -f app

# 测试对话
# 发送: "show me beginner snowboards"
# 应该看到: 🔧 Tool call #1: search_shop_catalog
```

### 对比：旧提示词 vs 新提示词

| 方面 | 旧提示词 | 新提示词 (Ridge) |
|------|---------|-----------------|
| **人设** | 通用助手 | 滑雪专家Ridge |
| **MCP触发** | 模糊的"when needed" | 明确的触发词列表 |
| **工具说明** | 无 | 5个工具的详细使用场景 |
| **对话示例** | 无 | 4个完整的对话流程 |
| **语言风格** | 正式 | 专业+亲切 |
| **行业知识** | 无 | 滑雪板术语和经验 |

### 预期效果

✅ **工具调用更主动**: AI会在识别到触发词时立即调用工具
✅ **响应更自然**: 不是生硬地显示结果，而是像顾问一样呈现
✅ **专业度提升**: 使用滑雪行业术语，分享相关经验
✅ **对话连贯性**: 明确的流程示例让AI知道如何串联工具调用和回复

### 下一步优化建议

1. **添加更多对话示例**: 针对复杂场景（比如多轮产品对比）
2. **个性化推荐逻辑**: 根据用户历史偏好调整推荐
3. **错误处理增强**: 当工具返回空结果时的应对策略
4. **多语言支持**: 虽然默认英文，但可以优化中文场景的表达

### 监控指标

部署后关注：
- **工具调用率**: 客户询问产品时，AI是否主动调用search_shop_catalog
- **对话轮次**: 平均完成一次购物咨询需要多少轮
- **转化率**: 从咨询到添加购物车的比例
- **客户反馈**: 语言风格是否自然、专业度是否合适

---

**版本**: 1.0
**更新日期**: 2025-12-10
**作者**: Claude Code
