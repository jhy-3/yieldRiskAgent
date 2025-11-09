import { config, validateConfig } from "./config";
import { LLMRiskAnalyzer } from "./llm";
import { BlockchainService } from "./blockchain";
import { StorageService } from "./storage";
import { APIService } from "./api";

/**
 * Aegis YieldRiskAgent 链下服务
 * 
 * 功能：
 * 1. 监听区块链上的 ServiceRequested 事件
 * 2. 调用 Gemini API 进行风险分析
 * 3. 将分析结果保存并上传哈希到链上
 * 4. 提供 HTTP API 供客户端查询结果
 */
class AegisOffChainService {
  private llmAnalyzer: LLMRiskAnalyzer;
  private blockchainService: BlockchainService;
  private storageService: StorageService;
  private apiService: APIService;

  constructor() {
    console.log("\n" + "=".repeat(60));
    console.log("🤖 Aegis YieldRiskAgent - Off-Chain Service");
    console.log("=".repeat(60));

    this.storageService = new StorageService();
    this.llmAnalyzer = new LLMRiskAnalyzer();
    this.blockchainService = new BlockchainService();
    this.apiService = new APIService(this.storageService);
  }

  /**
   * 启动服务
   */
  async start() {
    try {
      // 验证配置
      validateConfig();
      console.log("\n✅ Configuration validated");

      // 测试 LLM API 连接
      console.log("\n🧪 Testing LLM API connection...");
      const llmOk = await this.llmAnalyzer.testConnection();
      if (!llmOk) {
        throw new Error("LLM API connection failed");
      }

      // 测试区块链连接
      console.log("\n🧪 Testing blockchain connection...");
      const blockchainOk = await this.blockchainService.testConnection();
      if (!blockchainOk) {
        throw new Error("Blockchain connection failed");
      }

      // 启动 API 服务器
      this.apiService.start();

      // 监听区块链事件
      this.blockchainService.onServiceRequested(
        async (requestId, client, payment, protocolHash) => {
          await this.handleServiceRequest(requestId, client, protocolHash);
        }
      );

      console.log("\n" + "=".repeat(60));
      console.log("✅ Service is running!");
      console.log("=".repeat(60));
      console.log("\n💡 Workflow:");
      console.log("   1. Client submits protocol description to API: POST /protocol");
      console.log("   2. Client calls requestService() on blockchain with hash");
      console.log("   3. Service detects event, analyzes with Gemini");
      console.log("   4. Service calls completeService() on blockchain");
      console.log("   5. Client retrieves report from API: GET /report/:requestId");
      console.log("\n⌨️  Press Ctrl+C to stop\n");
    } catch (error) {
      console.error("\n❌ Failed to start service:", error);
      process.exit(1);
    }
  }

  /**
   * 处理服务请求
   */
  private async handleServiceRequest(
    requestId: bigint,
    client: string,
    protocolHash: string
  ) {
    const requestIdStr = requestId.toString();

    try {
      console.log("\n" + "─".repeat(60));
      console.log(`🔄 Processing request ${requestIdStr}`);
      console.log("─".repeat(60));

      // 1. 获取协议描述
      console.log("\n📖 Step 1: Fetching protocol description...");
      const description = this.storageService.getProtocolDescription(protocolHash);

      if (!description) {
        console.warn(`⚠️  No protocol description found for hash: ${protocolHash}`);
        console.warn("   Using placeholder description for demonstration");

        // 如果没有找到描述，使用一个示例
        const placeholderDescription = `
Unknown DeFi Protocol (Hash: ${protocolHash})
Client has requested risk analysis but did not provide protocol description.
This is a placeholder analysis.
        `.trim();

        this.storageService.saveProtocolDescription(protocolHash, placeholderDescription);
      }

      const protocolDescription =
        this.storageService.getProtocolDescription(protocolHash) || "";

      console.log("   Description length:", protocolDescription.length, "characters");
      console.log("   Preview:", protocolDescription.substring(0, 100) + "...");

      // 2. 使用 LLM API 分析
      console.log("\n🤖 Step 2: Analyzing with LLM API...");
      const analysis = await this.llmAnalyzer.analyzeProtocol(protocolDescription);

      console.log("   Protocol:", analysis.protocolName);
      console.log("   Risk Score:", analysis.overallRiskScore);
      console.log("   Risk Level:", analysis.riskLevel);
      console.log("   Risk Vectors:", analysis.riskVectors.length);

      // 3. 保存报告
      console.log("\n💾 Step 3: Saving report...");
      const reportHash = this.storageService.saveRiskReport(requestIdStr, analysis);

      // 4. 提交到区块链
      console.log("\n⛓️  Step 4: Submitting to blockchain...");
      const txHash = await this.blockchainService.completeService(requestId, reportHash);

      console.log("\n" + "─".repeat(60));
      console.log(`✅ Request ${requestIdStr} completed successfully!`);
      console.log("─".repeat(60));
      console.log("   Transaction:", txHash);
      console.log("   Report available at: GET /report/" + requestIdStr);
      console.log("\n");
    } catch (error) {
      console.error(`\n❌ Failed to process request ${requestIdStr}:`, error);
      // 在生产环境中，这里应该有重试逻辑或错误通知
    }
  }
}

// 启动服务
const service = new AegisOffChainService();
service.start();

// 优雅退出
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Shutting down gracefully...");
  process.exit(0);
});

