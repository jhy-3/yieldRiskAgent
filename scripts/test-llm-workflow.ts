import { ethers } from "hardhat";
import axios from "axios";

/**
 * 测试完整的 LLM 工作流：
 * 1. 客户端通过 HTTP API 提交协议描述
 * 2. 客户端在区块链上请求服务
 * 3. Off-chain 服务监听事件并调用 LLM
 * 4. 客户端从 HTTP API 获取风险报告
 */

const API_BASE_URL = "http://localhost:3001";
const YIELD_RISK_AGENT = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

async function main() {
  const [owner, client1] = await ethers.getSigners();

  console.log("🧪 Testing Complete LLM Workflow");
  console.log("=".repeat(70));
  console.log("Client:", client1.address);
  console.log("API:", API_BASE_URL);
  console.log();

  // Step 1: Submit protocol description to off-chain service
  console.log("📤 Step 1: Submitting protocol description to API...");
  console.log("-".repeat(70));

  const protocolDescription = `
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
`.trim();

  try {
    const response = await axios.post(`${API_BASE_URL}/protocol`, {
      description: protocolDescription,
    });

    console.log("✅ Protocol description submitted");
    console.log("   Hash:", response.data.hash);
    const protocolHash = response.data.hash;
    console.log();

    // Step 2: Request service on blockchain
    console.log("⛓️  Step 2: Requesting service on blockchain...");
    console.log("-".repeat(70));

    const yieldRiskAgent = await ethers.getContractAt("YieldRiskAgent", YIELD_RISK_AGENT);
    const serviceFee = await yieldRiskAgent.serviceFee();

    console.log("   Service fee:", ethers.formatEther(serviceFee), "ETH");
    console.log("   Protocol hash:", protocolHash);

    const tx = await yieldRiskAgent
      .connect(client1)
      .requestService(protocolHash, { value: serviceFee });

    const receipt = await tx.wait();
    console.log("✅ Service requested on blockchain");
    console.log("   Transaction:", receipt?.hash);

    // Extract requestId from event
    const requestEvent = receipt?.logs.find((log: any) => {
      try {
        const parsed = yieldRiskAgent.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "ServiceRequested";
      } catch {
        return false;
      }
    });

    let requestId = 0;
    if (requestEvent) {
      const parsed = yieldRiskAgent.interface.parseLog({
        topics: requestEvent.topics as string[],
        data: requestEvent.data,
      });
      requestId = Number(parsed?.args[0]);
      console.log("   Request ID:", requestId);
    }
    console.log();

    // Step 3: Wait for off-chain service to process
    console.log("⏳ Step 3: Waiting for off-chain service to analyze...");
    console.log("-".repeat(70));
    console.log("   (This may take 5-15 seconds depending on LLM response time)");

    // Poll for report
    let report = null;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (!report && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const reportResponse = await axios.get(`${API_BASE_URL}/report/${requestId}`);
        if (reportResponse.data) {
          report = reportResponse.data;
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          console.log("   Attempt", attempts, "- Still processing...");
        }
      }
    }

    if (!report) {
      console.log("❌ Timeout: Report not available after 30 seconds");
      console.log("   Check if off-chain service is running: npm start");
      process.exit(1);
    }

    console.log("✅ Risk analysis completed!");
    console.log();

    // Step 4: Display results
    console.log("📊 Step 4: Risk Analysis Report");
    console.log("=".repeat(70));
    console.log("Protocol Name:    ", report.protocolName);
    console.log("Overall Risk:     ", report.overallRiskScore, "/ 100");
    console.log("Risk Level:       ", report.riskLevel);
    console.log();
    console.log("Summary:");
    console.log(report.analysisSummary);
    console.log();
    console.log("Risk Vectors:");
    report.riskVectors.forEach((vector: any, index: number) => {
      console.log(`  ${index + 1}. ${vector.type} [${vector.severity}]`);
      console.log(`     ${vector.detail}`);
      console.log();
    });

    // Step 5: Verify on blockchain
    console.log("✅ Step 5: Verifying on blockchain...");
    console.log("-".repeat(70));

    const requestDetails = await yieldRiskAgent.getRequestDetails(requestId);
    console.log("Request Status:");
    console.log("   Completed:", requestDetails[3]);
    console.log("   Client:", requestDetails[0]);
    console.log("   Payment:", ethers.formatEther(requestDetails[1]), "ETH");
    console.log();

    console.log("🎉 Complete workflow test passed!");
    console.log("=".repeat(70));
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.error("\n💡 Solution: Make sure off-chain service is running:");
      console.error("   cd off-chain-service && npm start");
    }

    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

