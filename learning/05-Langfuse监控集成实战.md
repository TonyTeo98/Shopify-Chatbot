# Langfuse 监控集成实战

> 记录在 Shopify Chatbot 项目中集成 Langfuse LLM 监控的完整过程，包括遇到的问题、解决方案和最佳实践

---

## 一、为什么需要 Langfuse？

### 1.1 LLM 应用的可观测性挑战

在生产环境中运行 LLM 应用时，我们面临以下挑战：

- **成本控制**：每次 API 调用都会产生 token 费用，需要追踪和优化
- **性能监控**：响应时间、成功率、错误率需要实时监控
- **质量保证**：对话质量、用户满意度需要量化评估
- **调试困难**：出现问题时需要查看完整的输入输出历史

### 1.2 Langfuse 能做什么

Langfuse 是一个开源的 LLM 工程平台，提供：

| 功能 | 说明 |
|------|------|
| **Tracing** | 追踪每次 LLM 调用的完整生命周期 |
| **Usage Analytics** | Token 使用量、成本统计和趋势分析 |
| **Prompt Management** | 版本化管理 prompt，支持 A/B 测试 |
| **Evaluation** | 自动评估响应质量和准确性 |
| **User Feedback** | 收集和分析用户反馈 |

---

## 二、问题现场：observeAnthropic 不存在

### 2.1 错误信息

```bash
08:59:21 │ React Router │ [vite] (ssr) Error when evaluating SSR module
virtual:react-router/server-build: [vite] The requested module 'langfuse'
does not provide an export named 'observeAnthropic'
```

### 2.2 问题代码

```javascript
// app/services/claude.server.js (错误代码)
import { observeAnthropic } from "langfuse";  // ❌ 这个函数不存在！

const anthropic = observeAnthropic(new Anthropic(config), {
  clientInitParams: {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  },
});
```

### 2.3 问题根因分析

#### Python vs JavaScript 的集成差异

| 特性 | Python | JavaScript/TypeScript |
|------|--------|---------------------|
| **SDK 包名** | `langfuse` + `opentelemetry-instrumentation-anthropic` | `@langfuse/tracing` + `@langfuse/otel` |
| **Anthropic 包装函数** | ✅ 有 `observeAnthropic()` | ❌ 没有这个函数 |
| **集成方式** | 简单包装 | 需要 OpenTelemetry + 手动 tracing |
| **自动监控** | ✅ 自动追踪所有调用 | ❌ 需要手动创建 spans |

**关键区别**：Python 提供了 `observeAnthropic()` 这样的便捷包装函数，而 JavaScript 版本需要使用 OpenTelemetry 的标准方式进行集成。

---

## 三、解决方案：手动 Tracing 集成

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────┐
│                 entry.server.jsx                    │
│  (应用入口，初始化 OpenTelemetry)                    │
└─────────────────────────┬───────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────┐
│            instrumentation.server.js                │
│  ┌───────────────────────────────────────────────┐ │
│  │  NodeSDK                                       │ │
│  │    └─ LangfuseSpanProcessor                   │ │
│  │         └─ 收集 spans → 发送到 Langfuse       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────┐
│              claude.server.js                        │
│  ┌───────────────────────────────────────────────┐ │
│  │  startObservation()                           │ │
│  │    ↓                                          │ │
│  │  创建 Generation Span                         │ │
│  │    ↓                                          │ │
│  │  调用 Anthropic API                           │ │
│  │    ↓                                          │ │
│  │  记录 input/output/usage                      │ │
│  │    ↓                                          │ │
│  │  span.end()                                   │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 3.2 实施步骤

#### 步骤 1：安装依赖包

```bash
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node
```

**包说明**：
- `@langfuse/tracing`：核心 tracing API，提供 `startObservation()` 等函数
- `@langfuse/otel`：OpenTelemetry 集成，提供 `LangfuseSpanProcessor`
- `@opentelemetry/sdk-node`：OpenTelemetry Node.js SDK

#### 步骤 2：创建 Instrumentation 配置

```javascript
// app/instrumentation.server.js
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// 导出 processor 以便后续 flush
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  // 可选配置：
  // exportMode: "immediate"  // 适用于 serverless 环境
});

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor]
});

sdk.start();

console.log("Langfuse OpenTelemetry instrumentation initialized");
```

**关键点**：
- 导出 `langfuseSpanProcessor` 以便在请求结束时调用 `forceFlush()`
- `NodeSDK` 会自动设置全局的 OpenTelemetry context

#### 步骤 3：在应用入口导入

```javascript
// app/entry.server.jsx
// ⚠️ 必须在最顶部导入，确保 OpenTelemetry 最先初始化
import "./instrumentation.server.js";

import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
// ... 其他导入
```

**为什么要在入口导入？**
- OpenTelemetry 需要在任何其他代码运行前初始化
- 这样才能正确捕获所有的 spans
- 遵循 OpenTelemetry 的最佳实践

#### 步骤 4：修改 Claude Service

```javascript
// app/services/claude.server.js
import { Anthropic } from "@anthropic-ai/sdk";
import { startObservation } from "@langfuse/tracing";
import { langfuseSpanProcessor } from "../instrumentation.server.js";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

export function createClaudeService(apiKey = process.env.CLAUDE_API_KEY) {
  const config = { apiKey: apiKey };

  // 配置 BASE_URL 和 headers
  if (process.env.CLAUDE_BASE_URL) {
    config.baseURL = process.env.CLAUDE_BASE_URL;
  }

  config.defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 ...',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const anthropic = new Anthropic(config);

  // 检查 Langfuse 是否配置
  const langfuseEnabled = !!(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY
  );

  if (langfuseEnabled) {
    console.log("✅ Langfuse observability enabled");
  } else {
    console.log("ℹ️  Langfuse not configured");
  }

  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools
  }, streamHandlers) => {
    const systemInstruction = getSystemPrompt(promptType);
    const systemArray = [{ type: "text", text: systemInstruction }];

    // Langfuse 监控分支
    if (langfuseEnabled) {
      // 创建 generation span
      const span = startObservation(
        "anthropic-stream",
        {
          input: {
            // 截断 content 避免数据过大
            messages: messages.map(m => ({
              role: m.role,
              content: typeof m.content === 'string'
                ? m.content.substring(0, 200)
                : 'complex'
            })),
            model: AppConfig.api.defaultModel,
            toolCount: tools ? tools.length : 0
          },
          model: AppConfig.api.defaultModel,
        },
        { asType: "generation" }  // 指定为 generation 类型
      );

      try {
        // 调用 Anthropic API
        const stream = await anthropic.messages.stream({
          model: AppConfig.api.defaultModel,
          max_tokens: AppConfig.api.maxTokens,
          system: systemArray,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined
        });

        // 设置事件处理器
        if (streamHandlers.onText) {
          stream.on('text', streamHandlers.onText);
        }
        if (streamHandlers.onMessage) {
          stream.on('message', streamHandlers.onMessage);
        }
        if (streamHandlers.onContentBlock) {
          stream.on('contentBlock', streamHandlers.onContentBlock);
        }

        // 等待最终消息
        const finalMessage = await stream.finalMessage();

        // 更新 span 输出和 token 使用量
        span.update({
          output: {
            role: finalMessage.role,
            contentType: finalMessage.content.map(c => c.type).join(','),
            stopReason: finalMessage.stop_reason
          },
          usageDetails: finalMessage.usage ? {
            input: finalMessage.usage.input_tokens,
            output: finalMessage.usage.output_tokens,
            total: (finalMessage.usage.input_tokens || 0) +
                   (finalMessage.usage.output_tokens || 0),
          } : undefined,
        });

        span.end();

        // 处理 tool use
        if (streamHandlers.onToolUse && finalMessage.content) {
          for (const content of finalMessage.content) {
            if (content.type === "tool_use") {
              await streamHandlers.onToolUse(content);
            }
          }
        }

        // 强制 flush，确保数据发送
        await langfuseSpanProcessor.forceFlush();

        return finalMessage;
      } catch (error) {
        // 记录错误
        span.update({
          level: "ERROR",
          statusMessage: error.message,
        });
        span.end();
        throw error;
      }
    } else {
      // 无 Langfuse - 标准流程
      const stream = await anthropic.messages.stream({
        model: AppConfig.api.defaultModel,
        max_tokens: AppConfig.api.maxTokens,
        system: systemArray,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined
      });

      // ... 标准处理流程

      return finalMessage;
    }
  };

  const getSystemPrompt = (promptType) => {
    return systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}
```

### 3.3 环境配置

在 `.env` 文件中配置 Langfuse：

```bash
# Langfuse Configuration
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# 🇺🇸 如果使用美国区域
# LANGFUSE_BASE_URL=https://us.cloud.langfuse.com

# 🏠 如果自托管 Langfuse
# LANGFUSE_BASE_URL=https://your-langfuse-instance.com
```

---

## 四、技术细节深入

### 4.1 Observation Types

Langfuse 支持多种 observation 类型：

| Type | 用途 | 示例 |
|------|------|------|
| **span** | 通用操作 | 数据库查询、API 调用 |
| **generation** | LLM 生成 | Claude、GPT、Llama 调用 |
| **tool** | 工具调用 | Weather API、Calculator |
| **retriever** | 文档检索 | Vector search、RAG |
| **agent** | Agent 工作流 | LangChain Agent |
| **chain** | 多步骤链 | RAG pipeline |
| **evaluator** | 评估器 | Response quality check |

**我们为什么选择 `generation`？**
- 专门为 LLM 调用设计
- 自动追踪 token 使用量
- 支持成本计算
- 在 Langfuse UI 中有特殊展示

### 4.2 Usage Details 结构

```typescript
{
  usageDetails: {
    input: number,           // 输入 tokens
    output: number,          // 输出 tokens
    total: number,           // 总计 (可选)
    // 可以添加自定义字段
    cache_read_input_tokens?: number,
    some_other_token_count?: number,
  }
}
```

### 4.3 为什么需要 forceFlush()？

```javascript
await langfuseSpanProcessor.forceFlush();
```

**原因**：
- OpenTelemetry 默认会批量发送 spans（提高性能）
- 短生命周期请求可能在 flush 前就结束了
- `forceFlush()` 确保数据立即发送到 Langfuse

**适用场景**：
- Serverless 函数（Lambda、Vercel Functions）
- 短请求响应（<5 秒）
- 测试环境

### 4.4 Serverless 环境优化

如果部署在 serverless 环境（如 Vercel、AWS Lambda）：

```javascript
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: "immediate"  // 立即发送，不批量
});
```

---

## 五、验证与调试

### 5.1 启动应用

```bash
# 使用 localhost 模式
npx shopify app dev --use-localhost

# 或使用 cloudflare 隧道
npx shopify app dev
```

### 5.2 检查日志

成功初始化时会看到：

```
Langfuse OpenTelemetry instrumentation initialized
✅ Langfuse observability enabled
```

### 5.3 查看 Langfuse Dashboard

1. 登录 Langfuse: https://cloud.langfuse.com
2. 进入你的项目
3. 查看 **Traces** 页面

每次 API 调用会显示：

```
anthropic-stream (generation)
├─ Input: { messages, model, toolCount }
├─ Output: { role, contentType, stopReason }
├─ Usage: { input: 150, output: 320, total: 470 }
├─ Duration: 2.3s
└─ Cost: $0.015
```

### 5.4 常见问题排查

#### 问题 1：看不到 traces

**检查清单**：
- ✅ 环境变量是否正确配置？
- ✅ `instrumentation.server.js` 是否被导入？
- ✅ 是否调用了 `forceFlush()`？
- ✅ Langfuse keys 是否有效？

**调试方法**：
```javascript
// 添加调试日志
console.log('Langfuse enabled:', langfuseEnabled);
console.log('Creating span:', spanName);
console.log('Flushing spans...');
```

#### 问题 2：Spans 不完整

**可能原因**：
- `span.end()` 没有调用
- 异步操作没有正确 await
- 错误导致提前退出

**解决方案**：
```javascript
try {
  // ... 操作
  span.end();
} catch (error) {
  span.update({ level: "ERROR" });
  span.end();  // 确保 end 被调用
  throw error;
}
```

#### 问题 3：Token 统计不准确

**检查**：
```javascript
// 确保 usage 字段存在
if (finalMessage.usage) {
  span.update({
    usageDetails: {
      input: finalMessage.usage.input_tokens,
      output: finalMessage.usage.output_tokens,
    }
  });
}
```

---

## 六、最佳实践

### 6.1 输入数据截断

**问题**：完整的 messages 可能非常大（包含图片、长文本）

**解决**：
```javascript
input: {
  messages: messages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string'
      ? m.content.substring(0, 200)  // 只保留前 200 字符
      : 'complex'                     // 复杂类型标记
  })),
}
```

### 6.2 错误处理

**必须记录错误**：
```javascript
catch (error) {
  span.update({
    level: "ERROR",
    statusMessage: error.message,
    output: { error: error.stack }  // 可选：包含堆栈
  });
  span.end();
  throw error;  // 继续抛出，不吞掉错误
}
```

### 6.3 成本优化

**策略**：
- 使用采样（sampling）减少追踪数据量
- 监控 token 使用趋势，优化 prompt
- 设置 token 预算告警

**采样配置**：
```javascript
import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";

const sdk = new NodeSDK({
  sampler: new TraceIdRatioBasedSampler(0.1),  // 只追踪 10%
  spanProcessors: [langfuseSpanProcessor]
});
```

### 6.4 生产环境建议

```javascript
// 根据环境动态配置
const isProduction = process.env.NODE_ENV === 'production';

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: isProduction ? "batch" : "immediate",
  // 生产环境使用批量模式，开发环境使用即时模式
});

// 采样率
const sampler = isProduction
  ? new TraceIdRatioBasedSampler(0.05)  // 生产环境 5%
  : new AlwaysOnSampler();               // 开发环境全采样
```

---

## 七、Python 与 JavaScript 对比

### 7.1 Python 集成（简单）

```python
from anthropic import Anthropic
from opentelemetry.instrumentation.anthropic import AnthropicInstrumentor

# 一行代码自动监控所有 Anthropic 调用
AnthropicInstrumentor().instrument()

client = Anthropic()
message = client.messages.create(...)  # 自动追踪
```

### 7.2 JavaScript 集成（手动）

```javascript
// 需要手动创建 spans
const span = startObservation("name", { input }, { asType: "generation" });

try {
  const result = await anthropic.messages.create(...);
  span.update({ output, usageDetails });
  span.end();
} catch (error) {
  span.update({ level: "ERROR" });
  span.end();
}
```

### 7.3 为什么有这个差异？

| 原因 | Python | JavaScript |
|------|--------|-----------|
| **OpenTelemetry 生态** | 成熟，有大量自动 instrumentors | 相对较新，手动集成多 |
| **类型系统** | 动态类型，容易 monkey patching | 强类型（TypeScript），需要显式 |
| **框架支持** | LangChain 等框架原生支持 | 需要手动集成 |

---

## 八、扩展阅读

### 8.1 官方文档

- [Langfuse JS/TS SDK](https://js.reference.langfuse.com/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference)

### 8.2 进阶主题

1. **Prompt Management**: 版本化管理 system prompts
2. **Evaluations**: 自动评估响应质量
3. **User Feedback**: 集成用户评分系统
4. **Custom Metadata**: 添加 userId, sessionId 等
5. **Cost Tracking**: 基于 model 的成本计算

### 8.3 相关工具

| 工具 | 用途 |
|------|------|
| **LangSmith** | LangChain 官方监控平台 |
| **Helicone** | LLM 请求网关和分析 |
| **Weights & Biases** | 实验追踪和模型管理 |
| **PromptLayer** | Prompt 版本管理 |

---

## 九、总结

### 9.1 关键要点

✅ **JavaScript 没有 `observeAnthropic()`** - 需要使用 OpenTelemetry 手动集成

✅ **三个核心步骤**：
1. 初始化 OpenTelemetry SDK
2. 在入口文件导入 instrumentation
3. 用 `startObservation()` 包装 API 调用

✅ **记住 `forceFlush()`** - 确保短生命周期请求的数据被发送

✅ **区分环境** - 生产环境和开发环境使用不同配置

### 9.2 收益

- 📊 **可视化**：在 Langfuse UI 看到每次调用的详情
- 💰 **成本追踪**：实时监控 token 使用和费用
- 🐛 **调试**：出问题时快速定位原因
- 📈 **优化**：基于数据优化 prompt 和模型选择

### 9.3 下一步

- [ ] 添加 User ID 和 Session ID 追踪
- [ ] 集成 Prompt Management
- [ ] 设置成本预算告警
- [ ] 配置自动评估器
- [ ] 收集用户反馈数据

---

**最后更新**: 2025-12-07
**作者**: Claude & ZT
**标签**: `Langfuse` `OpenTelemetry` `Anthropic` `Monitoring` `Observability`
