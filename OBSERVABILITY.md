# Langfuse 可观测性增强文档

## 📊 概述

本项目已集成全面的 Langfuse 可观测性功能，可以追踪和分析 AI 对话的完整生命周期。

## ✨ 已实现的功能

### 1. 🔧 MCP 工具调用追踪

**位置**: `app/routes/chat.jsx:223-322`

每个 MCP 工具调用都会创建一个独立的 span，记录：
- **输入参数**: 工具调用的完整参数
- **输出结果**: 工具执行的返回结果
- **执行时间**: 工具调用的耗时（毫秒）
- **成功/失败状态**: 是否成功执行
- **错误信息**: 如果失败，记录错误详情

**示例数据**:
```json
{
  "name": "tool-searchProducts",
  "input": { "query": "red shoes" },
  "output": { "products": [...] },
  "metadata": {
    "toolUseId": "toolu_123",
    "conversationId": "1234567890",
    "executionTimeMs": 450,
    "success": true
  }
}
```

### 2. 🧠 思考过程（Thinking Blocks）记录

**位置**: `app/services/claude.server.js:118-123`

Claude 的内部推理过程会被捕获并记录到 Langfuse：
- **Thinking 内容**: 模型的推理步骤
- **完整上下文**: 与文本和工具调用一起展示

**示例数据**:
```json
{
  "type": "thinking",
  "thinking": "用户想要查找红色鞋子，我需要调用 searchProducts 工具..."
}
```

### 3. ⚡ 流式传输性能指标

**位置**: `app/services/claude.server.js:83-160`

记录详细的流式传输性能数据：
- **TTFT (Time To First Token)**: 用户发送消息后收到第一个 token 的时间
- **总流式传输时间**: 完整响应的生成时间
- **文本块数量**: 流式传输的 chunk 总数
- **平均块间隔**: 平均每个 chunk 的生成间隔

**示例数据**:
```json
{
  "metadata": {
    "performance": {
      "ttftMs": 234,
      "totalStreamTimeMs": 2456,
      "textChunkCount": 45,
      "averageChunkIntervalMs": 54.5
    }
  }
}
```

### 4. 🔄 对话轮次和循环检测

**位置**: `app/routes/chat.jsx:210-422`

追踪完整的对话流程：
- **对话轮次计数**: 记录 Claude 调用了多少轮
- **每轮详情**: 每轮的停止原因、耗时、是否使用工具
- **无限循环保护**: 最大 20 轮限制，防止死循环
- **会话级别指标**: 总时间、平均轮次时间、历史消息数

**示例数据**:
```json
{
  "output": {
    "turnCount": 3,
    "productsDisplayed": 5,
    "finalStopReason": "end_turn",
    "hitMaxTurns": false
  },
  "metadata": {
    "conversationMetrics": {
      "totalSessionTimeMs": 5234,
      "turnCount": 3,
      "turnDetails": [
        {
          "turnNumber": 1,
          "stopReason": "tool_use",
          "durationMs": 1200,
          "hasToolUse": true
        },
        {
          "turnNumber": 2,
          "stopReason": "tool_use",
          "durationMs": 1800,
          "hasToolUse": true
        },
        {
          "turnNumber": 3,
          "stopReason": "end_turn",
          "durationMs": 2234,
          "hasToolUse": false
        }
      ],
      "averageTurnTimeMs": 1744.6,
      "mcpToolsAvailable": 15,
      "historyMessageCount": 8
    },
    "businessMetrics": {
      "productsDisplayed": 5
    }
  }
}
```

## 🎯 Langfuse 中的层级结构

```
chat-session (会话级别 span)
├── anthropic-stream (第1轮生成 span)
│   └── metadata: performance metrics
├── tool-searchProducts (工具调用 span)
│   └── metadata: execution time, success status
├── anthropic-stream (第2轮生成 span)
│   └── metadata: performance metrics
├── tool-getProductDetails (工具调用 span)
│   └── metadata: execution time, success status
└── anthropic-stream (第3轮生成 span)
    └── metadata: performance metrics, thinking blocks
```

## 🚀 如何测试

### 前置条件
确保 `.env` 文件中配置了 Langfuse：
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxx
LANGFUSE_HOST=https://cloud.langfuse.com
```

### 测试步骤

1. **启动应用**
   ```bash
   npm run dev
   ```

2. **发送测试消息**
   在聊天界面发送一个会触发工具调用的消息，例如：
   ```
   "帮我找一些红色的鞋子"
   ```

3. **查看 Langfuse Dashboard**
   - 登录 [Langfuse Dashboard](https://cloud.langfuse.com)
   - 进入 Traces 页面
   - 找到最新的 `chat-session` trace
   - 展开查看所有 spans

### 预期结果

在 Langfuse 中，你应该能看到：

✅ **会话级别信息**
- 总对话轮次
- 每轮的停止原因
- 会话总耗时
- 产品推荐数量

✅ **每轮生成信息**
- TTFT 时间
- 流式传输总时间
- 文本块数量
- 思考过程（如果有）

✅ **工具调用信息**
- 调用的工具名称
- 输入参数
- 执行结果
- 执行耗时
- 成功/失败状态

## 📈 性能优化建议

基于可观测性数据，可以进行以下优化：

1. **TTFT 优化**: 如果 TTFT 过长（>500ms），考虑：
   - 优化系统提示词长度
   - 减少历史消息数量
   - 使用更快的模型

2. **工具调用优化**: 如果工具执行时间过长，考虑：
   - 添加缓存层
   - 优化 API 调用
   - 并行执行独立工具

3. **轮次优化**: 如果轮次过多（>5轮），考虑：
   - 改进工具定义和描述
   - 优化提示词引导
   - 使用 Function Calling 最佳实践

## 🔍 调试指南

### 查找慢请求
```sql
-- 在 Langfuse 中使用 SQL 过滤
WHERE metadata.performance.ttftMs > 1000
```

### 查找失败的工具调用
```sql
WHERE name LIKE 'tool-%' AND level = 'ERROR'
```

### 查找循环过多的会话
```sql
WHERE name = 'chat-session' AND output.turnCount > 10
```

## 📝 注意事项

1. **数据隐私**: 工具调用的参数会被记录，请确保不包含敏感信息
2. **性能影响**: Langfuse 追踪会增加少量延迟（通常 <50ms），因为使用了 `forceFlush()`
3. **成本**: 大量的 span 会增加 Langfuse 的存储成本，根据需要调整详细程度

## 🎉 总结

现在你的 Shopify Chatbot 拥有完整的可观测性能力！可以：
- 🔍 深入了解每个工具调用的细节
- 🧠 查看 AI 的思考过程
- ⚡ 监控性能瓶颈
- 🔄 追踪对话流程
- 📊 分析业务指标

Happy monitoring! 🚀
