/**
 * Chat API Route
 * Handles chat interactions with Claude API and tools
 */
import MCPClient from "../mcp-client";
import { saveMessage, getConversationHistory, storeCustomerAccountUrls, getCustomerAccountUrls as getCustomerAccountUrlsFromDb } from "../db.server";
import AppConfig from "../services/config.server";
import { createSseStream } from "../services/streaming.server";
import { createClaudeService } from "../services/claude.server";
import { createToolService } from "../services/tool.server";
import { startObservation } from "@langfuse/tracing";
import { langfuseSpanProcessor } from "../instrumentation.server.js";


/**
 * Rract Router loader function for handling GET requests
 */
export async function loader({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }

  const url = new URL(request.url);

  // Handle history fetch requests - matches /chat?history=true&conversation_id=XYZ
  if (url.searchParams.has('history') && url.searchParams.has('conversation_id')) {
    return handleHistoryRequest(request, url.searchParams.get('conversation_id'));
  }

  // Handle SSE requests
  if (!url.searchParams.has('history') && request.headers.get("Accept") === "text/event-stream") {
    return handleChatRequest(request);
  }

  // API-only: reject all other requests
  return new Response(JSON.stringify({ error: AppConfig.errorMessages.apiUnsupported }), { status: 400, headers: getCorsHeaders(request) });
}

/**
 * React Router action function for handling POST requests
 */
export async function action({ request }) {
  // Handle OPTIONS requests (CORS preflight)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request)
    });
  }
  return handleChatRequest(request);
}

/**
 * Handle history fetch requests
 * @param {Request} request - The request object
 * @param {string} conversationId - The conversation ID
 * @returns {Response} JSON response with chat history
 */
async function handleHistoryRequest(request, conversationId) {
  const messages = await getConversationHistory(conversationId);

  return new Response(JSON.stringify({ messages }), { headers: getCorsHeaders(request) });
}

/**
 * Handle chat requests (both GET and POST)
 * @param {Request} request - The request object
 * @returns {Response} Server-sent events stream
 */
async function handleChatRequest(request) {
  try {
    // Get message data from request body
    const body = await request.json();
    const userMessage = body.message;

    // Validate required message
    if (!userMessage) {
      return new Response(
        JSON.stringify({ error: AppConfig.errorMessages.missingMessage }),
        { status: 400, headers: getSseHeaders(request) }
      );
    }

    // Generate or use existing conversation ID
    const conversationId = body.conversation_id || Date.now().toString();
    const promptType = body.prompt_type || AppConfig.api.defaultPromptType;

    // Create a stream for the response
    const responseStream = createSseStream(async (stream) => {
      await handleChatSession({
        request,
        userMessage,
        conversationId,
        promptType,
        stream
      });
    });

    return new Response(responseStream, {
      headers: getSseHeaders(request)
    });
  } catch (error) {
    console.error('Error in chat request handler:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: getCorsHeaders(request)
    });
  }
}

/**
 * Handle a complete chat session
 * @param {Object} params - Session parameters
 * @param {Request} params.request - The request object
 * @param {string} params.userMessage - The user's message
 * @param {string} params.conversationId - The conversation ID
 * @param {string} params.promptType - The prompt type
 * @param {Object} params.stream - Stream manager for sending responses
 */
async function handleChatSession({
  request,
  userMessage,
  conversationId,
  promptType,
  stream
}) {
  // Initialize services
  const claudeService = createClaudeService();
  const toolService = createToolService();

  // Initialize MCP client
  const shopId = request.headers.get("X-Shopify-Shop-Id");
  const shopDomain = request.headers.get("Origin");
  const { mcpApiUrl } = await getCustomerAccountUrls(shopDomain, conversationId);

  const mcpClient = new MCPClient(
    shopDomain,
    conversationId,
    shopId,
    mcpApiUrl,
  );

  // Check if Langfuse is enabled
  const langfuseEnabled = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

  // Create a session-level span for the entire conversation
  let sessionSpan;
  if (langfuseEnabled) {
    sessionSpan = startObservation(
      "chat-session",
      {
        input: {
          userMessage,
          conversationId,
          promptType,
          shopDomain
        }
      },
      { asType: "span" }
    );
  }

  const sessionStartTime = Date.now();

  try {
    // Send conversation ID to client
    stream.sendMessage({ type: 'id', conversation_id: conversationId });

    // Connect to MCP servers and get available tools
    let storefrontMcpTools = [], customerMcpTools = [];

    try {
      storefrontMcpTools = await mcpClient.connectToStorefrontServer();
      customerMcpTools = await mcpClient.connectToCustomerServer();

      console.log(`Connected to MCP with ${storefrontMcpTools.length} tools`);
      console.log(`Connected to customer MCP with ${customerMcpTools.length} tools`);
    } catch (error) {
      console.warn('Failed to connect to MCP servers, continuing without tools:', error.message);
    }

    // Prepare conversation state
    let conversationHistory = [];
    let productsToDisplay = [];

    // Save user message to the database
    await saveMessage(conversationId, 'user', userMessage);

    // Fetch all messages from the database for this conversation
    const dbMessages = await getConversationHistory(conversationId);

    // Format messages for Claude API
    conversationHistory = dbMessages.map(dbMessage => {
      let content;
      try {
        content = JSON.parse(dbMessage.content);
      } catch (e) {
        content = dbMessage.content;
      }
      return {
        role: dbMessage.role,
        content
      };
    });

    // Execute the conversation stream
    let finalMessage = { role: 'user', content: userMessage };
    let turnCount = 0;
    const turnDetails = [];
    const MAX_TURNS = 10; // Prevent infinite loops - reduced from 20 for extra safety

    // Track tool calls to prevent duplicate invocations
    const toolCallHistory = new Map(); // key: tool signature (name:args), value: call count

    while (finalMessage.stop_reason !== "end_turn") {
      turnCount++;

      // Detect potential infinite loops
      if (turnCount > MAX_TURNS) {
        console.warn(`⚠️ Maximum turns (${MAX_TURNS}) reached, ending conversation`);
        break;
      }

      const turnStartTime = Date.now();

      finalMessage = await claudeService.streamConversation(
        {
          messages: conversationHistory,
          promptType,
          tools: mcpClient.tools
        },
        {
          // Handle text chunks
          onText: (textDelta) => {
            stream.sendMessage({
              type: 'chunk',
              chunk: textDelta
            });
          },

          // Handle complete messages
          onMessage: (message) => {
            conversationHistory.push({
              role: message.role,
              content: message.content
            });

            saveMessage(conversationId, message.role, JSON.stringify(message.content))
              .catch((error) => {
                console.error("Error saving message to database:", error);
              });

            // Send a completion message
            stream.sendMessage({ type: 'message_complete' });
          },

          // Handle tool use requests
          onToolUse: async (content) => {
            const toolName = content.name;
            const toolArgs = content.input;
            const toolUseId = content.id;

            // Generate tool call signature and check for duplicates
            const toolSignature = `${toolName}:${JSON.stringify(toolArgs)}`;
            const callCount = toolCallHistory.get(toolSignature) || 0;

            if (callCount >= 2) {
              // Duplicate tool call detected (3rd attempt)
              console.error(`🚫 Duplicate tool call detected (${callCount + 1} times): ${toolName}`);
              console.error(`   Arguments: ${JSON.stringify(toolArgs)}`);
              console.error(`   Force breaking conversation loop to prevent infinite recursion`);

              // Add error tool_result to terminate Claude's tool loop
              const errorToolResult = {
                role: 'user',
                content: [{
                  type: "tool_result",
                  tool_use_id: toolUseId,
                  content: "Error: Tool call limit reached. This tool has been called multiple times with the same parameters. Please provide a response to the user based on previous results."
                }]
              };
              conversationHistory.push(errorToolResult);

              // Save the error to database
              await saveMessage(conversationId, 'user', JSON.stringify(errorToolResult.content))
                .catch((error) => {
                  console.error("Error saving error tool result to database:", error);
                });

              // Force end_turn on next iteration
              finalMessage.stop_reason = 'end_turn';
              return; // Skip actual tool execution
            }

            // Record this tool call
            toolCallHistory.set(toolSignature, callCount + 1);
            console.log(`🔧 Tool call #${callCount + 1}: ${toolName}`);

            const toolUseMessage = `Calling tool: ${toolName} with arguments: ${JSON.stringify(toolArgs)}`;

            stream.sendMessage({
              type: 'tool_use',
              tool_use_message: toolUseMessage
            });

            // Check if Langfuse is enabled
            const langfuseEnabled = !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);

            let toolSpan;
            if (langfuseEnabled) {
              // Create a span for this tool call
              toolSpan = startObservation(
                `tool-${toolName}`,
                {
                  input: toolArgs,
                  metadata: {
                    toolUseId,
                    conversationId
                  }
                },
                { asType: "span" }
              );
            }

            const startTime = Date.now();
            let toolUseResponse;

            try {
              // Call the tool
              toolUseResponse = await mcpClient.callTool(toolName, toolArgs);

              const executionTime = Date.now() - startTime;

              // Update span with results
              if (langfuseEnabled && toolSpan) {
                toolSpan.update({
                  output: toolUseResponse,
                  metadata: {
                    toolUseId,
                    conversationId,
                    executionTimeMs: executionTime,
                    success: !toolUseResponse.error
                  },
                  level: toolUseResponse.error ? "ERROR" : "DEFAULT"
                });
                toolSpan.end();

                // Flush to ensure data is sent
                await langfuseSpanProcessor.forceFlush();
              }

              // Handle tool response based on success/error
              if (toolUseResponse.error) {
                await toolService.handleToolError(
                  toolUseResponse,
                  toolName,
                  toolUseId,
                  conversationHistory,
                  stream.sendMessage,
                  conversationId
                );
              } else {
                await toolService.handleToolSuccess(
                  toolUseResponse,
                  toolName,
                  toolUseId,
                  conversationHistory,
                  productsToDisplay,
                  conversationId
                );
              }
            } catch (error) {
              // Handle unexpected errors
              if (langfuseEnabled && toolSpan) {
                toolSpan.update({
                  level: "ERROR",
                  statusMessage: error.message,
                  metadata: {
                    toolUseId,
                    conversationId,
                    executionTimeMs: Date.now() - startTime
                  }
                });
                toolSpan.end();
                await langfuseSpanProcessor.forceFlush();
              }
              throw error;
            }

            // Signal new message to client
            stream.sendMessage({ type: 'new_message' });
          },

          // Handle content block completion
          onContentBlock: (contentBlock) => {
            if (contentBlock && contentBlock.type === 'text') {
              stream.sendMessage({
                type: 'content_block_complete',
                content_block: contentBlock
              });
            }
          }
        }
      );

      // Record turn details
      const turnEndTime = Date.now();
      turnDetails.push({
        turnNumber: turnCount,
        stopReason: finalMessage.stop_reason,
        durationMs: turnEndTime - turnStartTime,
        hasToolUse: finalMessage.content?.some(c => c.type === 'tool_use') || false
      });

      // Debug logging for conversation flow
      console.log(`\n📊 Turn ${turnCount} Summary:`);
      console.log(`   Stop Reason: ${finalMessage.stop_reason}`);
      console.log(`   Duration: ${turnEndTime - turnStartTime}ms`);
      console.log(`   Unique Tools Used: ${toolCallHistory.size}`);
      console.log(`   History Length: ${conversationHistory.length} messages`);
      if (toolCallHistory.size > 0) {
        console.log(`   Tool Call Details:`);
        toolCallHistory.forEach((count, signature) => {
          console.log(`      - ${signature.split(':')[0]}: ${count} time(s)`);
        });
      }
      console.log('');
    }

    // Signal end of turn
    stream.sendMessage({ type: 'end_turn' });

    // Send product results if available
    if (productsToDisplay.length > 0) {
      stream.sendMessage({
        type: 'product_results',
        products: productsToDisplay
      });
    }

    // Update session span with conversation metrics
    if (langfuseEnabled && sessionSpan) {
      const sessionEndTime = Date.now();
      const totalSessionTime = sessionEndTime - sessionStartTime;

      sessionSpan.update({
        output: {
          turnCount,
          productsDisplayed: productsToDisplay.length,
          finalStopReason: finalMessage.stop_reason,
          hitMaxTurns: turnCount >= MAX_TURNS
        },
        metadata: {
          conversationMetrics: {
            totalSessionTimeMs: totalSessionTime,
            turnCount,
            turnDetails,
            averageTurnTimeMs: turnCount > 0 ? totalSessionTime / turnCount : 0,
            mcpToolsAvailable: mcpClient.tools?.length || 0,
            historyMessageCount: conversationHistory.length
          },
          businessMetrics: {
            productsDisplayed: productsToDisplay.length
          }
        }
      });
      sessionSpan.end();

      // Flush to ensure data is sent
      await langfuseSpanProcessor.forceFlush();
    }
  } catch (error) {
    // Update session span with error
    if (langfuseEnabled && sessionSpan) {
      sessionSpan.update({
        level: "ERROR",
        statusMessage: error.message
      });
      sessionSpan.end();
      await langfuseSpanProcessor.forceFlush();
    }
    // The streaming handler takes care of error handling
    throw error;
  }
}

/**
 * Get the customer MCP API URL for a shop
 * @param {string} shopDomain - The shop domain
 * @param {string} conversationId - The conversation ID
 * @returns {string} The customer MCP API URL
 */
async function getCustomerAccountUrls(shopDomain, conversationId) {
  try {
    // Check if the customer account URL exists in the DB
    const existingUrls = await getCustomerAccountUrlsFromDb(conversationId);

    // If URL exists, return early with the MCP API URL
    if (existingUrls) return existingUrls;

    // If not, query for it from the Shopify API
    const { hostname } = new URL(shopDomain);

    const urls = await Promise.all([
      fetch(`https://${hostname}/.well-known/customer-account-api`).then(res => res.json()),
      fetch(`https://${hostname}/.well-known/openid-configuration`).then(res => res.json()),
    ]).then(async ([mcpResponse, openidResponse]) => {
      const response = {
        mcpApiUrl: mcpResponse.mcp_api,
        authorizationUrl: openidResponse.authorization_endpoint,
        tokenUrl: openidResponse.token_endpoint,
      };

      await storeCustomerAccountUrls({
        conversationId,
        mcpApiUrl: mcpResponse.mcp_api,
        authorizationUrl: openidResponse.authorization_endpoint,
        tokenUrl: openidResponse.token_endpoint,
      });

      return response;
    });

    return urls;
  } catch (error) {
    console.error("Error getting customer MCP API URL:", error);
    return null;
  }
}

/**
 * Gets CORS headers for the response
 * @param {Request} request - The request object
 * @returns {Object} CORS headers object
 */
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const requestHeaders = request.headers.get("Access-Control-Request-Headers") || "Content-Type, Accept";

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400" // 24 hours
  };

  // Handle Private Network Access preflight
  if (request.headers.get("Access-Control-Request-Private-Network") === "true") {
    headers["Access-Control-Allow-Private-Network"] = "true";
  }

  return headers;
}

/**
 * Get SSE headers for the response
 * @param {Request} request - The request object
 * @returns {Object} SSE headers object
 */
function getSseHeaders(request) {
  const origin = request.headers.get("Origin") || "*";

  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
    "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  };
}
