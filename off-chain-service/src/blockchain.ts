import { ethers } from "ethers";
import { config } from "./config";

// YieldRiskAgent ABI (简化版，仅包含需要的函数和事件)
const YIELD_RISK_AGENT_ABI = [
  "event ServiceRequested(uint256 indexed requestId, address indexed client, uint256 payment, bytes32 protocolDescriptionHash)",
  "event ServiceCompleted(uint256 indexed requestId, bytes32 riskReportHash)",
  "function completeService(uint256 requestId, bytes32 riskReportHash) external",
  "function getRequestDetails(uint256 requestId) external view returns (address client, uint256 payment, uint256 timestamp, bool completed, bool refunded)",
];

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private yieldRiskAgent: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.yieldRiskAgent = new ethers.Contract(
      config.yieldRiskAgentAddress,
      YIELD_RISK_AGENT_ABI,
      this.wallet
    );

    console.log("🔗 Blockchain service initialized");
    console.log("   Agent address:", config.yieldRiskAgentAddress);
    console.log("   Agent owner:", this.wallet.address);
  }

  /**
   * 监听 ServiceRequested 事件
   */
  onServiceRequested(
    callback: (requestId: bigint, client: string, payment: bigint, protocolHash: string) => void
  ) {
    console.log("👂 Listening for ServiceRequested events...");

    this.yieldRiskAgent.on(
      "ServiceRequested",
      (requestId: bigint, client: string, payment: bigint, protocolHash: string, event: any) => {
        console.log("\n📥 New service request received!");
        console.log("   Request ID:", requestId.toString());
        console.log("   Client:", client);
        console.log("   Payment:", ethers.formatEther(payment), "ETH");
        console.log("   Protocol Hash:", protocolHash);
        console.log("   Block:", event.log.blockNumber);

        callback(requestId, client, payment, protocolHash);
      }
    );
  }

  /**
   * 完成服务并提交报告哈希到链上
   */
  async completeService(requestId: bigint, riskReportHash: string): Promise<string> {
    console.log(`\n📝 Completing service for request ${requestId}...`);
    console.log("   Report hash:", riskReportHash);

    try {
      const tx = await this.yieldRiskAgent.completeService(requestId, riskReportHash);
      console.log("   Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("   ✅ Transaction confirmed in block:", receipt.blockNumber);
      console.log("   Gas used:", receipt.gasUsed.toString());

      return tx.hash;
    } catch (error) {
      console.error("   ❌ Failed to complete service:", error);
      throw error;
    }
  }

  /**
   * 获取请求详情
   */
  async getRequestDetails(requestId: bigint) {
    const details = await this.yieldRiskAgent.getRequestDetails(requestId);
    return {
      client: details[0],
      payment: details[1],
      timestamp: details[2],
      completed: details[3],
      refunded: details[4],
    };
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log("✅ Blockchain connection successful");
      console.log("   Network:", network.name, "Chain ID:", network.chainId);
      console.log("   Wallet balance:", ethers.formatEther(balance), "ETH");
      return true;
    } catch (error) {
      console.error("❌ Blockchain connection failed:", error);
      return false;
    }
  }
}

