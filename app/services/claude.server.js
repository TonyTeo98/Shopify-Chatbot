/**
 * Claude Service
 * Manages interactions with the Claude API
 */
import { Anthropic } from "@anthropic-ai/sdk";
import { startObservation } from "@langfuse/tracing";
import { langfuseSpanProcessor } from "../instrumentation.server.js";
import AppConfig from "./config.server";
import systemPrompts from "../prompts/prompts.json";

/**
 * Creates a Claude service instance
 * @param {string} apiKey - Claude API key
 * @returns {Object} Claude service with methods for interacting with Claude API
 */
export function createClaudeService(apiKey = process.env.CLAUDE_API_KEY) {
  // Initialize Claude client
  const config = { apiKey: apiKey };

  // 支持自定义 BASE_URL（如使用代理或其他兼容 API）
  if (process.env.CLAUDE_BASE_URL) {
    config.baseURL = process.env.CLAUDE_BASE_URL;
  }

  // 添加自定义请求头，绕过 Cloudflare 拦截
  config.defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // 创建 Anthropic 客户端
  const anthropic = new Anthropic(config);

  // Check if Langfuse is configured
  const langfuseEnabled = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
  if (langfuseEnabled) {
    console.log("✅ Langfuse observability enabled");
  } else {
    console.log("ℹ️  Langfuse not configured - set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY to enable monitoring");
  }

  /**
   * Streams a conversation with Claude
   * @param {Object} params - Stream parameters
   * @param {Array} params.messages - Conversation history
   * @param {string} params.promptType - The type of system prompt to use
   * @param {Array} params.tools - Available tools for Claude
   * @param {Object} streamHandlers - Stream event handlers
   * @param {Function} streamHandlers.onText - Handles text chunks
   * @param {Function} streamHandlers.onMessage - Handles complete messages
   * @param {Function} streamHandlers.onToolUse - Handles tool use requests
   * @returns {Promise<Object>} The final message
   */
  const streamConversation = async ({
    messages,
    promptType = AppConfig.api.defaultPromptType,
    tools
  }, streamHandlers) => {
    // Get system prompt from configuration or use default
    const systemInstruction = getSystemPrompt(promptType);

    // Create stream
    // 将 system 转换为数组格式，兼容某些代理服务
    const systemArray = [{ type: "text", text: systemInstruction }];

    // If Langfuse is enabled, wrap the API call with tracing
    if (langfuseEnabled) {
      const span = startObservation(
        "anthropic-stream",
        {
          input: {
            messages: messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 200) : 'complex' })),
            model: AppConfig.api.defaultModel,
            toolCount: tools ? tools.length : 0
          },
          model: AppConfig.api.defaultModel,
        },
        { asType: "generation" }
      );

      try {
        // Track streaming performance metrics
        const streamStartTime = Date.now();
        let firstTokenTime = null;
        let textChunkCount = 0;

        const stream = await anthropic.messages.stream({
          model: AppConfig.api.defaultModel,
          max_tokens: AppConfig.api.maxTokens,
          system: systemArray,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined
        });

        // Set up event handlers
        if (streamHandlers.onText) {
          stream.on('text', (textDelta) => {
            // Track TTFT (Time To First Token)
            if (!firstTokenTime) {
              firstTokenTime = Date.now();
            }
            textChunkCount++;
            streamHandlers.onText(textDelta);
          });
        }

        if (streamHandlers.onMessage) {
          stream.on('message', streamHandlers.onMessage);
        }

        if (streamHandlers.onContentBlock) {
          stream.on('contentBlock', streamHandlers.onContentBlock);
        }

        // Wait for final message
        const finalMessage = await stream.finalMessage();
        const streamEndTime = Date.now();
        const totalStreamTime = streamEndTime - streamStartTime;
        const ttft = firstTokenTime ? firstTokenTime - streamStartTime : null;

        // Update span with output and usage information
        // Extract actual content from the message
        const outputContent = finalMessage.content.map(c => {
          if (c.type === 'text') {
            return c.text;
          } else if (c.type === 'tool_use') {
            return {
              type: 'tool_use',
              name: c.name,
              input: c.input
            };
          } else if (c.type === 'thinking') {
            return {
              type: 'thinking',
              thinking: c.thinking
            };
          }
          return c;
        });

        span.update({
          output: {
            role: finalMessage.role,
            content: outputContent,
            contentType: finalMessage.content.map(c => c.type).join(','),
            stopReason: finalMessage.stop_reason
          },
          usageDetails: finalMessage.usage ? {
            input: finalMessage.usage.input_tokens,
            output: finalMessage.usage.output_tokens,
            total: (finalMessage.usage.input_tokens || 0) + (finalMessage.usage.output_tokens || 0),
          } : undefined,
          metadata: {
            performance: {
              ttftMs: ttft,
              totalStreamTimeMs: totalStreamTime,
              textChunkCount: textChunkCount,
              averageChunkIntervalMs: textChunkCount > 1 ? totalStreamTime / textChunkCount : null
            }
          }
        });

        span.end();

        // Process tool use requests
        if (streamHandlers.onToolUse && finalMessage.content) {
          for (const content of finalMessage.content) {
            if (content.type === "tool_use") {
              await streamHandlers.onToolUse(content);
            }
          }
        }

        // Flush Langfuse spans to ensure data is sent
        await langfuseSpanProcessor.forceFlush();

        return finalMessage;
      } catch (error) {
        // Log error in span
        span.update({
          level: "ERROR",
          statusMessage: error.message,
        });
        span.end();
        throw error;
      }
    } else {
      // No Langfuse - use standard flow
      const stream = await anthropic.messages.stream({
        model: AppConfig.api.defaultModel,
        max_tokens: AppConfig.api.maxTokens,
        system: systemArray,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined
      });

      // Set up event handlers
      if (streamHandlers.onText) {
        stream.on('text', streamHandlers.onText);
      }

      if (streamHandlers.onMessage) {
        stream.on('message', streamHandlers.onMessage);
      }

      if (streamHandlers.onContentBlock) {
        stream.on('contentBlock', streamHandlers.onContentBlock);
      }

      // Wait for final message
      const finalMessage = await stream.finalMessage();

      // Process tool use requests
      if (streamHandlers.onToolUse && finalMessage.content) {
        for (const content of finalMessage.content) {
          if (content.type === "tool_use") {
            await streamHandlers.onToolUse(content);
          }
        }
      }

      return finalMessage;
    }
  };

  /**
   * Gets the system prompt content for a given prompt type
   * @param {string} promptType - The prompt type to retrieve
   * @returns {string} The system prompt content
   */
  const getSystemPrompt = (promptType) => {
    return systemPrompts.systemPrompts[promptType]?.content ||
      systemPrompts.systemPrompts[AppConfig.api.defaultPromptType].content;
  };

  return {
    streamConversation,
    getSystemPrompt
  };
}

export default {
  createClaudeService
};
