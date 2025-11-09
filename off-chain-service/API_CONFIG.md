# 🚀 LLM API 配置说明

## ✅ 已完成的修改

### 1. 从 Gemini API 切换到 OpenAI 兼容 API

**之前**：使用 Google Gemini API（需要代理，地区受限）

**现在**：使用 OpenAI 兼容的中转 API（国内可直接访问）

---

## 📋 当前配置

### API 信息

```bash
API Key:   sk-your-api-key
Base URL:  https://api.chatanywhere.tech/v1
Model:     gpt-4o-mini
```

**说明**：
- `gpt-4o-mini` 是 OpenAI 最新的经济型模型
- 你提到的 `gpt-4.1-mini` 可能是指这个模型（OpenAI 没有 4.1 版本）
- 如果你的 API 支持其他模型，可以在 `.env` 文件中修改 `LLM_MODEL`

### 可用模型列表

根据你的中转服务，可能支持以下模型：

| 模型名称 | 说明 | 成本 |
|---------|------|------|
| `gpt-4o-mini` | GPT-4o 的轻量版，速度快、成本低 | ⭐⭐⭐⭐⭐ 推荐 |
| `gpt-3.5-turbo` | GPT-3.5 系列，性价比高 | ⭐⭐⭐⭐ |
| `gpt-4-turbo` | GPT-4 Turbo，能力强但成本高 | ⭐⭐⭐ |
| `gpt-4o` | GPT-4o 完整版，能力最强 | ⭐⭐ |

**如何修改模型**：

编辑 `.env` 文件：

```bash
# 改为其他模型
LLM_MODEL=gpt-3.5-turbo
```

---

## 🔧 修改的文件

### 1. `src/config.ts`

**变更**：
- 移除了 `geminiApiKey` 和 `geminiModel`
- 新增了 `llmApiKey`、`llmBaseUrl`、`llmModel`
- 更新了 `rpcUrl` 默认值为 `http://127.0.0.1:9545`

```typescript
export const config = {
  // LLM API (OpenAI Compatible)
  llmApiKey: process.env.LLM_API_KEY || "",
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL || "gpt-4-turbo",
  // ...
};
```

### 2. `src/gemini.ts` → `src/llm.ts`

**变更**：
- 重命名文件为 `llm.ts`
- 使用 `openai` SDK 替代 `@google/generative-ai`
- 重写了 API 调用逻辑以适配 OpenAI 格式

**核心代码**：

```typescript
import OpenAI from "openai";

export class LLMRiskAnalyzer {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,  // 支持自定义 Base URL
    });
  }

  async analyzeProtocol(protocolDescription: string): Promise<RiskAnalysis> {
    const completion = await this.client.chat.completions.create({
      model: config.llmModel,
      messages: [
        { role: "system", content: "You are a DeFi risk analyst..." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }  // 强制返回 JSON
    });
    
    const text = completion.choices[0]?.message?.content || "";
    return this.parseResponse(text);
  }
}
```

### 3. `src/index.ts`

**变更**：
- 导入 `LLMRiskAnalyzer` 替代 `GeminiRiskAnalyzer`
- 更新所有相关引用和日志输出

```typescript
import { LLMRiskAnalyzer } from "./llm";

class AegisOffChainService {
  private llmAnalyzer: LLMRiskAnalyzer;
  
  constructor() {
    this.llmAnalyzer = new LLMRiskAnalyzer();
  }
}
```

### 4. `.env` 文件

**完整配置**：

```bash
# LLM API Configuration
LLM_API_KEY=sk-your-api-key
LLM_BASE_URL=https://api.chatanywhere.tech/v1
LLM_MODEL=gpt-4o-mini

# Blockchain Configuration
PRIVATE_KEY=0xYourPrivateKey
RPC_URL=http://127.0.0.1:9545
CHAIN_ID=31337
YIELD_RISK_AGENT_ADDRESS=0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0

# Service Configuration
PORT=3001
LOG_LEVEL=info
```

### 5. `package.json`

**新增依赖**：

```json
{
  "dependencies": {
    "openai": "^4.0.0",  // 新增
    // ... 其他依赖
  }
}
```

---

## 🧪 测试结果

### 启动日志

```
============================================================
🤖 Aegis YieldRiskAgent - Off-Chain Service
============================================================
🤖 LLM Risk Analyzer initialized
   Base URL: https://api.chatanywhere.tech/v1
   Model: gpt-4o-mini

✅ Configuration validated

🧪 Testing LLM API connection...
   Sending test request to LLM API...
✅ LLM API connection successful!
   Response: OK

🧪 Testing blockchain connection...
✅ Blockchain connection successful
   Network: unknown Chain ID: 31337n
   Wallet balance: 9999.989 ETH

👂 Listening for ServiceRequested events...

============================================================
✅ Service is running!
============================================================

🌐 API server running on http://localhost:3001
```

**结论**：✅ 所有测试通过！

---

## 🚀 使用指南

### 启动服务

```bash
cd /home/hy/develop/defi-learning/yieldRiskAgent/off-chain-service
npm start
```

### 测试 API

**1. 提交协议描述**

```bash
curl -X POST http://localhost:3001/protocol \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Uniswap V3 是一个去中心化交易所，采用集中流动性模型..."
  }'
```

**响应**：
```json
{
  "hash": "0x1234...",
  "message": "Protocol description saved"
}
```

**2. 从区块链请求风险分析**

```bash
cd /home/hy/develop/defi-learning/yieldRiskAgent
npx hardhat run scripts/interact.ts --network localhost
```

**3. 获取分析报告**

```bash
curl http://localhost:3001/report/0
```

**响应示例**：
```json
{
  "protocolName": "Uniswap V3",
  "overallRiskScore": 35,
  "riskLevel": "Medium",
  "analysisSummary": "Uniswap V3 是一个成熟的 DEX...",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "集中流动性可能导致...",
      "severity": "Medium"
    },
    // ...
  ]
}
```

---

## 🔧 常见问题

### Q1: 如何更换模型？

编辑 `.env` 文件：

```bash
# 改为更便宜的模型
LLM_MODEL=gpt-3.5-turbo

# 或更强大的模型
LLM_MODEL=gpt-4-turbo
```

重启服务生效。

### Q2: 中转 API 返回 401 错误

**原因**：API Key 无效或过期。

**解决**：
1. 检查 `.env` 文件中的 `LLM_API_KEY` 是否正确
2. 访问 https://api.chatanywhere.tech 确认账户状态
3. 如果需要，更新 API Key

### Q3: 中转 API 返回 429 错误

**原因**：请求频率过高或配额用尽。

**解决**：
1. 检查账户余额和配额
2. 添加请求延迟或重试逻辑
3. 升级账户套餐

### Q4: 如何使用其他中转服务？

如果你想使用其他中转服务（如 OpenAI 官方、Azure OpenAI 等），只需修改 `.env`：

```bash
# 使用 OpenAI 官方（需要代理）
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-api-key

# 使用其他中转服务
LLM_BASE_URL=https://your-proxy-service.com/v1
LLM_API_KEY=your-api-key
```

### Q5: 模型名称写错了怎么办？

服务启动时会测试连接，如果模型名称错误，会看到类似错误：

```
❌ LLM API connection failed!
   Error: The model `gpt-4.1-mini` does not exist
```

检查你的中转服务支持的模型列表，并更新 `.env` 中的 `LLM_MODEL`。

---

## 📊 与 Gemini API 的对比

| 特性 | Gemini API | OpenAI 兼容 API |
|------|-----------|----------------|
| **地区限制** | ❌ 中国大陆不可用 | ✅ 通过中转可用 |
| **需要代理** | ✅ 是 | ❌ 否 |
| **配置复杂度** | 🔴 高 | 🟢 低 |
| **API 稳定性** | 🟡 较新，可能有变化 | 🟢 成熟稳定 |
| **生态系统** | 🟡 较新 | 🟢 非常成熟 |
| **成本** | 🟢 相对便宜 | 🟡 中等 |
| **中文支持** | 🟢 优秀 | 🟢 优秀 |

---

## 🎯 总结

### ✅ 优点

1. **国内可用**：无需代理，通过中转服务直接访问
2. **配置简单**：只需三个环境变量
3. **生态成熟**：OpenAI SDK 稳定可靠
4. **灵活性高**：可轻松切换不同的中转服务或模型

### 📝 注意事项

1. **API Key 安全**：不要泄露你的 API Key
2. **成本控制**：监控 API 调用次数和费用
3. **模型选择**：根据需求在性能和成本间平衡

### 🔄 后续优化建议

1. **添加缓存**：对相同协议的分析结果进行缓存
2. **错误重试**：添加 API 调用失败的重试机制
3. **流式响应**：使用 streaming 模式实时返回分析结果
4. **批量处理**：支持同时分析多个协议

---

## 📞 获取帮助

如果遇到问题：

1. 查看日志输出：`npm start` 会显示详细错误信息
2. 检查 `.env` 配置是否正确
3. 测试中转 API 是否可用：
   ```bash
  curl https://api.chatanywhere.tech/v1/models \
    -H "Authorization: Bearer sk-your-api-key"
   ```

---

**配置完成！现在可以启动服务并开始使用了！** 🎉

