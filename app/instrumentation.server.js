/**
 * OpenTelemetry Instrumentation for Langfuse
 * This file initializes the OpenTelemetry SDK with Langfuse span processor
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

// Export the processor to be able to flush it
export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  // Configure for serverless environments if needed
  // exportMode: "immediate"
});

const sdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor]
});

sdk.start();

console.log("Langfuse OpenTelemetry instrumentation initialized");
