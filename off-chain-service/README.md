# Aegis 链下服务 - Gemini API 集成

这是 YieldRiskAgent 的**链下服务**部分，负责：

1. 🎧 监听区块链上的 `ServiceRequested` 事件
2. 🤖 调用 **Gemini API** 进行 DeFi 风险分析
3. 💾 保存分析报告
4. ⛓️ 将报告哈希提交回区块链
5. 🌐 提供 HTTP API 供客户端查询结果

## 🚀 快速开始

### 1. 安装依赖

```bash
cd off-chain-service
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env
```

填写以下信息：

```bash
# 从部署脚本获取
YIELD_RISK_AGENT_ADDRESS=0x...

# 你的私钥（Agent 所有者）
PRIVATE_KEY=0xYourPrivateKey

# RPC URL
RPC_URL=http://127.0.0.1:8545

# Gemini API 密钥（从 https://ai.google.dev/ 获取）
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. 启动服务

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

## 📊 工作流程

```
1. 客户端提交协议描述
   POST http://localhost:3000/protocol
   Body: { "description": "Aave V3: Deposit USDC..." }
   Response: { "hash": "0x123..." }

2. 客户端调用智能合约
   yieldRiskAgent.requestService(hash, { value: fee })

3. 链下服务自动监听事件
   ✓ 检测到 ServiceRequested 事件
   ✓ 从存储中获取协议描述
   ✓ 调用 Gemini API 分析
   ✓ 保存分析报告
   ✓ 调用 completeService() 提交哈希

4. 客户端获取报告
   GET http://localhost:3000/report/0
```

## 🔌 API 端点

### 健康检查
```bash
GET http://localhost:3000/health
```

### 提交协议描述
```bash
POST http://localhost:3000/protocol
Content-Type: application/json

{
  "description": "Aave V3 on Base: Users deposit USDC and earn interest..."
}

Response:
{
  "success": true,
  "hash": "0x1234...",
  "message": "Protocol description saved. Use this hash when calling requestService()."
}
```

### 获取风险报告
```bash
GET http://localhost:3000/report/:requestId

Response:
{
  "success": true,
  "requestId": "0",
  "report": {
    "protocolName": "Aave V3",
    "overallRiskScore": 25,
    "riskLevel": "Low",
    "analysisSummary": "...",
    "riskVectors": [...]
  },
  "reportHash": "0xabcd..."
}
```

### 获取统计信息
```bash
GET http://localhost:3000/stats

Response:
{
  "success": true,
  "stats": {
    "totalReports": 5,
    "totalProtocols": 3,
    "averageRiskScore": 45.2
  }
}
```

## 🧪 完整测试示例

### Terminal 1: 启动链下服务
```bash
cd off-chain-service
npm start
```

### Terminal 2: 与服务交互

```bash
# 1. 提交协议描述
curl -X POST http://localhost:3000/protocol \
  -H "Content-Type: application/json" \
  -d '{
    "description": "X-Farm on Base: Deposits USDC into Aave, borrows ETH, then opens leveraged long position on GMX"
  }'

# 保存返回的 hash

# 2. 在区块链上请求服务（使用 Hardhat console 或脚本）
# yieldRiskAgent.requestService(hash, { value: serviceFee })

# 3. 等待链下服务处理（查看 Terminal 1 的日志）

# 4. 获取报告
curl http://localhost:3000/report/0
```

## 🤖 Gemini API 集成详解

### 提示词工程

链下服务使用精心设计的提示词（见 `src/gemini.ts`），指导 Gemini 扮演：
- 世界级 DeFi 风险分析师
- 智能合约审计员

分析的风险维度包括：
- 经济风险（Economic Risk）
- 智能合约风险（Smart Contract Risk）
- 中心化风险（Centralization Risk）
- 组合性风险（Composition Risk）

### 风险评分标准

- **0-25**: 低风险 - 成熟协议，攻击面小
- **26-50**: 中等风险 - 有些问题但总体安全
- **51-75**: 高风险 - 多个重大问题，谨慎使用
- **76-100**: 危急 - 严重问题，强烈建议不使用

### 示例分析输出

```json
{
  "protocolName": "X-Farm (User-Described)",
  "overallRiskScore": 85,
  "riskLevel": "High / Critical",
  "analysisSummary": "该协议采用杠杆农场策略，虽然使用了 Aave 和 GMX 等成熟协议，但风险极高。",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "杠杆风险：GMX 上的杠杆多头仓位面临极高的清算风险。ETH 价格的剧烈波动可能导致抵押品被清算，导致本金全部损失。",
      "severity": "Critical"
    },
    {
      "type": "Smart Contract Risk",
      "detail": "新合约风险：'X-Farm' 本身是一个新协议。其管理存款和执行策略的智能合约可能未经审计，或存在漏洞。",
      "severity": "High"
    },
    {
      "type": "Composition Risk",
      "detail": "风险叠加：您同时承担 Aave 的合约风险、GMX 的平台风险，以及 X-Farm 自身的策略和合约风险。",
      "severity": "High"
    }
  ]
}
```

## 📂 项目结构

```
off-chain-service/
├── src/
│   ├── index.ts          # 主入口，启动服务
│   ├── config.ts         # 配置管理
│   ├── gemini.ts         # Gemini API 集成 ⭐
│   ├── blockchain.ts     # 区块链交互
│   ├── storage.ts        # 数据存储
│   └── api.ts            # HTTP API 服务器
├── data/                 # 数据文件（自动创建）
│   ├── protocols.json    # 协议描述
│   └── reports.json      # 风险报告
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 开发

### 构建
```bash
npm run build
```

### 运行生产构建
```bash
npm run build
node dist/index.js
```

### 日志

服务会输出详细的日志：
- 📥 收到的服务请求
- 🤖 Gemini API 调用
- 💾 数据保存
- ⛓️ 区块链交易
- ✅ 完成状态

## 🔐 安全注意事项

1. **API 密钥**: 永远不要提交 `.env` 文件到 Git
2. **私钥管理**: 使用专用的服务账户，不要使用主钱包
3. **生产环境**: 
   - 使用数据库代替文件存储
   - 添加速率限制
   - 实现请求队列
   - 添加监控和告警

## 🚀 生产部署建议

### 使用 PM2
```bash
npm install -g pm2
pm2 start dist/index.js --name aegis-service
pm2 save
pm2 startup
```

### 使用 Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

### 环境变量管理
- 使用 AWS Secrets Manager、HashiCorp Vault 等
- 不要在代码中硬编码密钥

## 📊 监控

建议监控的指标：
- 请求处理时间
- Gemini API 响应时间
- 失败率
- 区块链交易确认时间
- API 服务器正常运行时间

## 🆘 故障排除

### Gemini API 错误
```
Error: Gemini API connection failed
```
**解决**: 检查 `GEMINI_API_KEY` 是否正确，访问 https://ai.google.dev/ 确认配额

### 区块链连接失败
```
Error: Blockchain connection failed
```
**解决**: 
1. 检查 `RPC_URL` 是否正确
2. 确认 Hardhat 节点正在运行（`npm run node`）
3. 检查网络连接

### 没有检测到事件
**原因**: 合约地址配置错误或服务启动晚于事件触发
**解决**: 
1. 确认 `YIELD_RISK_AGENT_ADDRESS` 正确
2. 重启服务
3. 重新发送请求

## 📞 获取 Gemini API 密钥

1. 访问 https://ai.google.dev/
2. 点击 "Get API Key"
3. 创建新项目或选择现有项目
4. 生成 API 密钥
5. 复制密钥到 `.env` 文件

**注意**: Gemini API 有免费配额，超出后需要付费。

## 🎉 完整示例

查看 `examples/` 目录（如果有）或参考主项目的 `scripts/interact.ts` 了解完整的使用流程。

---

**这就是真正的 Gemini API 集成！** 🤖🔥

