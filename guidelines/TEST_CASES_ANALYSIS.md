# 📊 YieldRiskAgent 测试用例详细分析

## 🎯 项目核心功能

**YieldRiskAgent** 是一个基于 ERC8004 标准的 DeFi 收益策略风险评估 Agent，使用 LLM（GPT-4o-mini）分析各种 DeFi 收益协议的风险。

---

## 📝 测试用例概览

项目中包含 **3 类测试用例**：

1. **合约单元测试** - 测试智能合约功能
2. **基础交互示例** - 测试简单的 yield farming 策略
3. **LLM 完整工作流** - 测试真实的 DEX 协议分析

---

## 🔬 测试用例 1: X-Farm 杠杆收益策略

### 📍 位置
`scripts/interact.ts` 第 36 行

### 🎯 测试问题

```
X-Farm: Deposits USDC -> Aave -> Borrows ETH -> GMX leveraged long
```

### 📖 策略解读

这是一个**多层嵌套的杠杆收益策略**：

```
用户资金流向：
┌──────────────────────────────────────────────────────┐
│ 1. 用户存入 USDC 到 X-Farm 协议                       │
│    ↓                                                  │
│ 2. X-Farm 将 USDC 存入 Aave 作为抵押品               │
│    ↓                                                  │
│ 3. 从 Aave 借出 ETH                                   │
│    ↓                                                  │
│ 4. 将借出的 ETH 在 GMX 上开杠杆做多                   │
│    ↓                                                  │
│ 5. 期望通过 ETH 价格上涨获得收益                      │
└──────────────────────────────────────────────────────┘
```

### 🚨 涉及的风险维度

#### 1. **经济风险 (Economic Risk) - 极高**

**清算风险**：
- 如果 ETH 价格下跌，GMX 上的多头头寸会被清算
- 同时 Aave 上的抵押率下降，可能触发二次清算
- **级联清算**：一个协议的清算会影响另一个

**无常损失风险**：
- 借贷利率波动
- 资金费率（GMX）
- 多层协议的费用累积

**预言机操纵**：
- Aave 依赖 Chainlink 预言机
- GMX 使用自己的预言机
- 预言机偏差可能导致不当清算

#### 2. **智能合约风险 (Smart Contract Risk) - 高**

**组合风险**：
- 依赖 3 个协议（X-Farm + Aave + GMX）
- 任何一个协议的漏洞都会影响整个策略
- **风险叠加**：总风险 > 单个协议风险之和

**未审计风险**：
- X-Farm 可能是新协议，缺乏审计
- Aave 和 GMX 虽然成熟，但集成代码可能有问题

**重入攻击**：
- 多次跨合约调用
- 状态更新顺序问题

#### 3. **流动性风险 (Liquidity Risk) - 高**

**提款风险**：
- 需要按逆序清算头寸：GMX → Aave → X-Farm
- 如果任何一步流动性不足，资金被锁定

**市场深度**：
- GMX 做空流动性可能不足以平仓
- Aave 借贷池利用率过高时，还款困难

#### 4. **中心化风险 (Centralization Risk) - 中等**

**治理风险**：
- X-Farm 可能由小团队控制
- 参数调整（费用、清算阈值）影响用户

**升级风险**：
- 可升级合约可能引入恶意代码
- Admin key 控制

### 💰 预期风险评分

```json
{
  "protocolName": "X-Farm Leveraged Yield Strategy",
  "overallRiskScore": 85,
  "riskLevel": "Critical",
  "analysisSummary": "高度复杂的杠杆策略，涉及多层协议组合。经济风险和清算风险极高，不适合风险厌恶型投资者。"
}
```

### 🎓 用户教育价值

这个测试用例展示了 **DeFi 乐高的危险性**：
- 协议组合增加复杂度
- 风险呈指数级增长
- 需要专业的风险评估工具

---

## 🔬 测试用例 2: Uniswap V3 流动性提供

### 📍 位置
`scripts/test-llm-workflow.ts` 第 28-50 行

### 🎯 测试问题

```
Uniswap V3 是一个去中心化交易所协议，主要特点：

1. 集中流动性（Concentrated Liquidity）
   - LP 可以在特定价格区间内提供流动性
   - 提高资金效率，但增加无常损失风险

2. 多级费率
   - 0.05%, 0.3%, 1% 三档费率
   - 适应不同波动性的交易对

3. 非同质化流动性头寸
   - 每个 LP 头寸是独特的 NFT
   - 增加了管理复杂度

4. 预言机功能
   - 内置时间加权平均价格（TWAP）预言机
   - 可能被操纵的风险

5. 治理和升级
   - Uniswap 治理控制协议参数
   - 存在一定的中心化风险
```

### 📖 策略解读

这是一个**真实的 DEX 流动性挖矿场景**：

```
用户角色：流动性提供者（LP）
┌──────────────────────────────────────────────────────┐
│ 用户向 Uniswap V3 池子提供流动性（如 ETH/USDC）       │
│ ↓                                                     │
│ 设置价格区间（集中流动性）                            │
│ ↓                                                     │
│ 赚取交易手续费                                        │
│ ↓                                                     │
│ 承担无常损失风险                                      │
└──────────────────────────────────────────────────────┘
```

### 🚨 涉及的风险维度

#### 1. **经济风险 (Economic Risk) - 中等**

**无常损失（Impermanent Loss）**：
```
示例：
初始状态：提供 1 ETH ($2000) + 2000 USDC
价格区间：$1800 - $2200

场景 A：ETH 涨到 $3000
- 池子自动卖出 ETH，买入 USDC
- 如果超出价格区间，头寸变为全部 USDC
- 相比直接持有，损失约 5.7%

场景 B：ETH 跌到 $1500
- 池子自动卖出 USDC，买入 ETH
- 如果低于价格区间，头寸变为全部 ETH
- 相比直接持有，损失约 2.0%
```

**集中流动性放大无常损失**：
- 价格区间越窄，资金效率越高，但无常损失越大
- 需要频繁调整价格区间

#### 2. **智能合约风险 (Smart Contract Risk) - 低**

**代码审计**：
- ✅ Uniswap V3 经过多次审计（Trail of Bits, ABDK, etc.）
- ✅ 主网运行 2+ 年，TVL 数十亿美元
- ⚠️ 但仍有已知漏洞（如 reentrancy guard 边缘情况）

**复杂性**：
- 代码比 V2 复杂 3 倍以上
- NFT 头寸管理增加攻击面

#### 3. **操作风险 (Operational Risk) - 中等**

**主动管理需求**：
- 需要监控价格区间
- 价格超出区间时，停止赚取费用
- 需要定期 rebalance

**Gas 成本**：
- Mint/Burn/Collect 操作 gas 较高
- 频繁调整不经济

#### 4. **预言机风险 (Oracle Risk) - 低**

**TWAP 操纵**：
- Uniswap V3 内置预言机
- 使用时间加权平均价格，难以操纵
- 但对于低流动性池子仍有风险

#### 5. **治理风险 (Governance Risk) - 低**

**去中心化程度**：
- Uniswap 治理相对成熟
- 大型变更需要社区投票
- 但仍可能引入不利参数

### 💰 预期风险评分

```json
{
  "protocolName": "Uniswap V3",
  "overallRiskScore": 35,
  "riskLevel": "Medium",
  "analysisSummary": "成熟的 DEX 协议，智能合约风险较低，但集中流动性增加了无常损失和主动管理需求。适合经验丰富的 LP。"
}
```

### 🎓 用户教育价值

展示了 **传统 AMM 的改进与权衡**：
- 资本效率 ↑ → 管理复杂度 ↑
- 收益潜力 ↑ → 无常损失风险 ↑
- 需要理解价格区间策略

---

## 🧪 测试用例 3: 合约单元测试场景

### 📍 位置
`test/YieldRiskAgent.test.ts`

### 🎯 测试问题

虽然单元测试中使用的是**抽象的协议哈希**，但测试覆盖了以下真实场景：

#### 场景 A：正常的服务流程
```typescript
// 模拟：客户请求评估某个收益协议
protocolHash = keccak256("Compound V3 USDC Supply Strategy")
payment = 0.001 ETH
↓
// Agent 分析并完成
riskReportHash = keccak256(JSON.stringify(riskAnalysis))
↓
// 客户满意，给好评
feedbackScore = 95/100
↓
// 托管资金释放给 Agent
```

#### 场景 B：糟糕的服务质量
```typescript
// 模拟：Agent 提供了低质量分析
riskReportHash = keccak256("Random gibberish")
↓
// 客户不满，给差评
feedbackScore = 30/100
↓
// 触发退款机制
if (averageScore < 60) {
  refund to client;
}
```

#### 场景 C：超时保护
```typescript
// 模拟：Agent 长时间未响应
24 hours passed...
↓
// 客户可以主动释放托管
releaseEscrow() // 防止资金永久锁定
```

---

## 🤖 LLM 分析框架

### Prompt 结构

Agent 向 LLM（GPT-4o-mini）提问时使用的 **Prompt 模板**：

```typescript
You are a world-class DeFi risk analyst and smart contract auditor with expertise in:
- Economic security and game theory
- Smart contract vulnerabilities (reentrancy, oracle manipulation, etc.)
- DeFi protocol design patterns
- Liquidity risks and composability risks
- Centralization and governance risks

Your task is to analyze the following DeFi protocol description and provide 
a comprehensive risk assessment.

Protocol Description:
"""
${protocolDescription}
"""

Please provide your analysis in the following JSON format:
{
  "protocolName": "Extract or infer the protocol name",
  "overallRiskScore": <0-100, where 100 is highest risk>,
  "riskLevel": "<Low / Medium / High / Critical>",
  "analysisSummary": "<2-3 sentence summary>",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "<Detailed explanation of economic risks>",
      "severity": "<Low/Medium/High/Critical>"
    },
    // ... more risk vectors
  ]
}
```

### 分析维度

LLM 被要求从 **4 个核心维度** 评估风险：

#### 1. **Economic Risk（经济风险）**
- 清算风险
- 预言机操纵
- 滑点和交易成本
- 激励机制设计缺陷
- 代币经济学问题

#### 2. **Smart Contract Risk（智能合约风险）**
- 代码漏洞（reentrancy, overflow, etc.）
- 审计状态
- 代码复杂度
- 升级机制
- Access control

#### 3. **Centralization Risk（中心化风险）**
- Admin key 控制
- 治理集中度
- 可升级性
- 多签安全
- 依赖中心化服务

#### 4. **Composition Risk（组合风险）**
- 依赖的外部协议数量
- 集成复杂度
- 失败传播（一个失败导致全部失败）
- 跨协议交互
- 流动性依赖

### 风险评分标准

```
0-25:  Low Risk
       - 成熟协议
       - 多次审计
       - TVL 稳定
       - 简单机制
       
26-50: Medium Risk
       - 经过审计但较新
       - 中等复杂度
       - 一些已知限制
       - 需要主动管理
       
51-75: High Risk
       - 多个显著风险
       - 复杂的协议组合
       - 审计覆盖不全
       - 高度依赖外部协议
       
76-100: Critical Risk
        - 未审计
        - 多层杠杆
        - 已知严重漏洞
        - 极高清算风险
```

---

## 📊 实际测试结果示例

### 测试 1: X-Farm 策略分析

**输入**：
```
X-Farm: Deposits USDC -> Aave -> Borrows ETH -> GMX leveraged long
```

**预期 LLM 输出**：
```json
{
  "protocolName": "X-Farm Leveraged Yield Strategy",
  "overallRiskScore": 85,
  "riskLevel": "Critical",
  "analysisSummary": "这是一个极高风险的多层杠杆策略。组合了借贷（Aave）和永续合约（GMX），存在级联清算风险。ETH 价格波动会被杠杆放大，不适合普通用户。",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "级联清算风险极高。如果 ETH 下跌 15-20%，GMX 头寸可能被清算，同时触发 Aave 清算。借贷利率和资金费率波动会侵蚀收益。预言机偏差可能导致不公平清算。",
      "severity": "Critical"
    },
    {
      "type": "Smart Contract Risk",
      "detail": "依赖 3 个协议（X-Farm、Aave、GMX），风险叠加。X-Farm 作为新协议，集成代码可能存在漏洞。虽然 Aave 和 GMX 都经过审计，但复杂的跨协议调用增加了重入攻击和状态不一致的风险。",
      "severity": "High"
    },
    {
      "type": "Centralization Risk",
      "detail": "X-Farm 的治理和控制机制未知。如果是小团队运营，存在 admin key 风险和参数恶意修改风险（费用、清算阈值等）。Aave 和 GMX 的治理相对成熟，但仍可能影响策略表现。",
      "severity": "Medium"
    },
    {
      "type": "Composition Risk",
      "detail": "高度依赖外部协议。退出策略需要按顺序操作：平仓 GMX → 偿还 Aave → 提取 X-Farm。任何一步失败都会导致资金被锁定。市场压力时期，流动性可能不足以完成退出。",
      "severity": "High"
    }
  ]
}
```

### 测试 2: Uniswap V3 分析

**输入**：
```
Uniswap V3 是一个去中心化交易所协议...
（完整描述见上文）
```

**预期 LLM 输出**：
```json
{
  "protocolName": "Uniswap V3",
  "overallRiskScore": 35,
  "riskLevel": "Medium",
  "analysisSummary": "成熟的 DEX 协议，智能合约经过充分审计。主要风险是集中流动性带来的更高无常损失和主动管理需求。适合理解 AMM 机制的经验型 LP。",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "集中流动性显著提高资金效率，但也放大无常损失。当价格移出设定区间，LP 停止赚取手续费且完全暴露于单一资产。对于高波动性资产，频繁 rebalance 会侵蚀利润。需要深入理解价格区间策略。",
      "severity": "Medium"
    },
    {
      "type": "Smart Contract Risk",
      "detail": "Uniswap V3 经过 Trail of Bits、ABDK 等多家机构审计，主网运行超过 2 年，TVL 数十亿美元。虽然代码复杂度比 V2 高 3 倍，但已证明相对安全。NFT 头寸管理增加了一些攻击面，但未发现严重漏洞。",
      "severity": "Low"
    },
    {
      "type": "Centralization Risk",
      "detail": "Uniswap 治理由 UNI 代币持有者控制，相对去中心化。协议升级需要通过治理提案。虽然有一定的中心化风险（大户控制投票），但历史上治理决策较为合理。",
      "severity": "Low"
    },
    {
      "type": "Composition Risk",
      "detail": "作为基础设施协议，Uniswap V3 不依赖外部协议。但内置的 TWAP 预言机被许多其他协议依赖，对于低流动性池子存在操纵风险。LP 本身的组合风险较低。",
      "severity": "Low"
    }
  ]
}
```

---

## 🎯 测试用例的设计意图

### 1. **覆盖不同风险等级**

| 测试用例 | 风险等级 | 用途 |
|---------|---------|------|
| X-Farm | Critical (85) | 测试极高风险场景，验证 LLM 能识别复杂组合风险 |
| Uniswap V3 | Medium (35) | 测试成熟协议，验证 LLM 能平衡风险与收益 |
| 单元测试 | N/A | 测试合约逻辑，独立于 LLM |

### 2. **覆盖不同协议类型**

- **收益聚合器**：X-Farm（多协议组合）
- **DEX/AMM**：Uniswap V3（流动性提供）
- **潜在扩展**：
  - 借贷协议（Aave, Compound）
  - 稳定币（Curve, Frax）
  - 衍生品（dYdX, Perpetual Protocol）
  - 跨链桥（需要额外风险分析）

### 3. **教育用户理解风险**

通过这些测试用例，用户可以学习：

- ✅ 协议组合增加风险
- ✅ 杠杆放大收益也放大损失
- ✅ 新协议 vs 成熟协议的区别
- ✅ 主动管理的重要性
- ✅ 无常损失的真实影响

---

## 🚀 如何添加新的测试用例

如果你想测试其他 DeFi 协议，可以这样做：

### 示例：测试 Curve 3pool

```typescript
const protocolDescription = `
Curve Finance 3pool 是一个稳定币流动性池：

1. 池子组成
   - USDT, USDC, DAI 三种稳定币
   - 总 TVL 约 $1B+

2. 收益来源
   - 交易手续费（0.04%）
   - CRV 代币奖励
   - 可能的 veCRV boost（最高 2.5x）

3. 风险点
   - 稳定币脱钩风险（如 USDC depeg 事件）
   - CRV 代币价格波动
   - 智能合约风险（虽然已审计）

4. 使用场景
   - 稳定币之间套利
   - 收益农场的基础层
   - 许多协议依赖 3pool 定价
`;

// 提交到 API
const response = await axios.post('http://localhost:3001/protocol', {
  description: protocolDescription
});

// 在区块链上请求服务
await yieldRiskAgent.connect(client).requestService(response.data.hash, {
  value: ethers.parseEther("0.001")
});

// LLM 会返回类似：
// {
//   "protocolName": "Curve 3pool",
//   "overallRiskScore": 25,
//   "riskLevel": "Low",
//   "analysisSummary": "成熟的稳定币流动性池，无常损失风险极低..."
// }
```

---

## 📚 总结

### 项目的核心价值

1. **自动化风险评估**：使用 LLM 分析复杂的 DeFi 协议
2. **声誉系统**：基于 ERC8004 的可验证评价
3. **托管保护**：确保服务质量，保护用户资金
4. **可扩展**：支持各种 DeFi 协议类型

### 测试用例的覆盖面

- ✅ 高风险杠杆策略
- ✅ 中低风险 LP 策略
- ✅ 智能合约功能测试
- ✅ 端到端 LLM 工作流

### 实际应用场景

作为用户，你可以向 Agent 提问：

1. **收益农场**："Yearn Finance USDC vault 的风险如何？"
2. **借贷**："在 Aave 上借 ETH 做多的清算风险？"
3. **稳定币**："UST/LUNA 崩盘后，Frax 的稳定机制是否安全？"
4. **跨链桥**："使用 Multichain 桥接资产的风险？"
5. **新协议**："这个新的 yield optimizer 是否值得信任？"

**Agent 会从经济、技术、治理、组合四个维度给出专业分析！** 🎯

