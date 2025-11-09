import { ethers } from "hardhat";

/**
 * Interactive script to test YieldRiskAgent functionality
 * Update the addresses below with your deployed contract addresses
 */

// 从最新部署中获取的合约地址
// 运行 npm run deploy:local 后更新这些地址
const IDENTITY_REGISTRY = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
const REPUTATION_REGISTRY = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
const YIELD_RISK_AGENT = "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";
const AGENT_ID = 0; // Your agent ID

async function main() {
  const [owner, client1, client2] = await ethers.getSigners();
  
  console.log("🔗 Connecting to contracts...\n");
  
  const identityRegistry = await ethers.getContractAt("IdentityRegistry", IDENTITY_REGISTRY);
  const reputationRegistry = await ethers.getContractAt("ReputationRegistry", REPUTATION_REGISTRY);
  const yieldRiskAgent = await ethers.getContractAt("YieldRiskAgent", YIELD_RISK_AGENT);
  
  console.log("Owner:", owner.address);
  console.log("Client 1:", client1.address);
  console.log("Client 2:", client2.address);
  console.log();
  
  // Example 1: Client requests service
  console.log("📝 Example 1: Client requests risk assessment");
  console.log("-".repeat(60));
  
  const serviceFee = await yieldRiskAgent.serviceFee();
  console.log("Service fee:", ethers.formatEther(serviceFee), "ETH");
  
  const protocolDescription = "X-Farm: Deposits USDC -> Aave -> Borrows ETH -> GMX leveraged long";
  const protocolHash = ethers.keccak256(ethers.toUtf8Bytes(protocolDescription));
  
  console.log("Protocol description:", protocolDescription);
  console.log("Description hash:", protocolHash);
  
  const requestTx = await yieldRiskAgent.connect(client1).requestService(protocolHash, {
    value: serviceFee
  });
  const receipt = await requestTx.wait();
  console.log("✅ Service requested by client1");
  
  // 从事件中提取 requestId
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
  }
  
  console.log("Request ID:", requestId);
  const requestDetails = await yieldRiskAgent.getRequestDetails(requestId);
  console.log("Request details:", {
    client: requestDetails[0],
    payment: ethers.formatEther(requestDetails[1]),
    completed: requestDetails[3],
    refunded: requestDetails[4]
  });
  console.log();
  
  // Example 2: Agent completes service (如果还未完成)
  console.log("🤖 Example 2: Agent completes analysis");
  console.log("-".repeat(60));
  
  const currentDetails = await yieldRiskAgent.getRequestDetails(requestId);
  const isCompleted = currentDetails[3];
  
  if (isCompleted) {
    console.log("⏭️  Service already completed (possibly by off-chain service)");
    console.log("   Skipping manual completion...");
  } else {
    const riskReport = JSON.stringify({
      protocolName: "X-Farm",
      overallRiskScore: 85,
      riskLevel: "High / Critical",
      riskVectors: [
        { type: "Economic Risk", detail: "High liquidation risk on GMX" },
        { type: "Smart Contract Risk", detail: "Unaudited new protocol" }
      ]
    });
    const reportHash = ethers.keccak256(ethers.toUtf8Bytes(riskReport));
    
    console.log("Risk report generated (off-chain)");
    console.log("Report hash:", reportHash);
    
    const completeTx = await yieldRiskAgent.connect(owner).completeService(requestId, reportHash);
    await completeTx.wait();
    console.log("✅ Service completed by agent owner");
  }
  console.log();
  
  // Example 3: Client gives feedback
  console.log("⭐ Example 3: Client gives feedback");
  console.log("-".repeat(60));
  
  // First, agent owner must create feedbackAuth
  console.log("Creating feedback authorization...");
  
  const feedbackAuth = {
    agentId: AGENT_ID,
    clientAddress: client1.address,
    indexLimit: 100, // 允许客户端提交多次反馈（测试用）
    expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
    chainId: (await ethers.provider.getNetwork()).chainId,
    identityRegistry: IDENTITY_REGISTRY,
    signerAddress: owner.address
  };
  
  // Encode and sign
  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "uint64", "uint256", "uint256", "address", "address"],
    [
      feedbackAuth.agentId,
      feedbackAuth.clientAddress,
      feedbackAuth.indexLimit,
      feedbackAuth.expiry,
      feedbackAuth.chainId,
      feedbackAuth.identityRegistry,
      feedbackAuth.signerAddress
    ]
  );
  
  const messageHash = ethers.keccak256(encoded);
  const signature = await owner.signMessage(ethers.getBytes(messageHash));
  
  const feedbackAuthBytes = encoded + signature.slice(2);
  
  console.log("Feedback authorization created and signed");
  
  // Client gives feedback
  const feedbackScore = 95; // Good feedback
  const feedbackUri = "ipfs://QmFeedbackDetails";
  const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes("Great analysis!"));
  const tag1 = ethers.encodeBytes32String("HighAccuracy");
  const tag2 = ethers.encodeBytes32String("FastResponse");
  
  const feedbackTx = await reputationRegistry.connect(client1).giveFeedback(
    AGENT_ID,
    feedbackScore,
    tag1,
    tag2,
    feedbackUri,
    feedbackHash,
    feedbackAuthBytes
  );
  await feedbackTx.wait();
  console.log("✅ Feedback submitted:", feedbackScore, "/ 100");
  console.log();
  
  // Example 4: Check reputation
  console.log("📊 Example 4: Check agent reputation");
  console.log("-".repeat(60));
  
  const reputation = await yieldRiskAgent.getReputationSummary();
  console.log("Reputation summary:");
  console.log("  • Total feedbacks:", reputation[0].toString());
  console.log("  • Average score:", reputation[1].toString(), "/ 100");
  console.log();
  
  // Example 5: Release escrow (after timeout)
  console.log("💰 Example 5: Release escrow");
  console.log("-".repeat(60));
  console.log("Note: In production, this would be called after escrowTimeout");
  console.log("      For testing, you may need to increase block time");
  console.log();
  
  const stats = await yieldRiskAgent.getStatistics();
  console.log("Agent statistics:");
  console.log("  • Total requests:", stats[0].toString());
  console.log("  • Total earned:", ethers.formatEther(stats[1]), "ETH");
  console.log("  • Total refunded:", ethers.formatEther(stats[2]), "ETH");
  console.log("  • Active escrow:", ethers.formatEther(stats[3]), "ETH");
  
  console.log("\n✅ Interaction examples completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

