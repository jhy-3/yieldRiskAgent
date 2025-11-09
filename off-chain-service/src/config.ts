import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  // Blockchain
  privateKey: process.env.PRIVATE_KEY || "",
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:9545",
  chainId: parseInt(process.env.CHAIN_ID || "31337"),
  yieldRiskAgentAddress: process.env.YIELD_RISK_AGENT_ADDRESS || "",

  // LLM API (OpenAI Compatible)
  llmApiKey: process.env.LLM_API_KEY || "",
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL || "gpt-4-turbo",

  // Service
  port: parseInt(process.env.PORT || "3000"),
  logLevel: process.env.LOG_LEVEL || "info",
};

export function validateConfig() {
  const required = [
    "privateKey",
    "rpcUrl",
    "yieldRiskAgentAddress",
    "llmApiKey",
  ];

  const missing = required.filter((key) => !config[key as keyof typeof config]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

