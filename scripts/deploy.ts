import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting ERC8004 + YieldRiskAgent deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Step 1: Deploy IdentityRegistry
  console.log("1️⃣  Deploying IdentityRegistry...");
  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("✅ IdentityRegistry deployed to:", identityAddress, "\n");

  // Step 2: Deploy ReputationRegistry
  console.log("2️⃣  Deploying ReputationRegistry...");
  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputationRegistry = await ReputationRegistry.deploy(identityAddress);
  await reputationRegistry.waitForDeployment();
  const reputationAddress = await reputationRegistry.getAddress();
  console.log("✅ ReputationRegistry deployed to:", reputationAddress, "\n");

  // Step 3: Deploy ValidationRegistry
  console.log("3️⃣  Deploying ValidationRegistry...");
  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validationRegistry = await ValidationRegistry.deploy(identityAddress);
  await validationRegistry.waitForDeployment();
  const validationAddress = await validationRegistry.getAddress();
  console.log("✅ ValidationRegistry deployed to:", validationAddress, "\n");

  // Step 4: Register an agent
  console.log("4️⃣  Registering Aegis LLM Agent...");
  const agentMetadataUri = "ipfs://QmAegisAgentMetadata"; // Replace with actual IPFS URI
  // 使用明确的函数签名来避免重载歧义
  const registerTx = await identityRegistry["register(string)"](agentMetadataUri);
  const receipt = await registerTx.wait();
  
  // Extract agentId from Registered event
  const registeredEvent = receipt?.logs.find((log: any) => {
    try {
      const parsed = identityRegistry.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      return parsed?.name === "Registered";
    } catch {
      return false;
    }
  });

  let agentId = 0n;
  if (registeredEvent) {
    const parsed = identityRegistry.interface.parseLog({
      topics: registeredEvent.topics as string[],
      data: registeredEvent.data,
    });
    agentId = parsed?.args?.agentId;
  }

  console.log("✅ Agent registered with ID:", agentId.toString());
  console.log("   Owner:", deployer.address, "\n");

  // Step 5: Deploy YieldRiskAgent
  console.log("5️⃣  Deploying YieldRiskAgent...");
  const serviceFee = ethers.parseEther("0.001"); // 0.001 ETH
  const escrowTimeout = 24 * 60 * 60; // 24 hours

  const YieldRiskAgent = await ethers.getContractFactory("YieldRiskAgent");
  const yieldRiskAgent = await YieldRiskAgent.deploy(
    identityAddress,
    reputationAddress,
    agentId,
    serviceFee,
    escrowTimeout
  );
  await yieldRiskAgent.waitForDeployment();
  const agentContractAddress = await yieldRiskAgent.getAddress();
  console.log("✅ YieldRiskAgent deployed to:", agentContractAddress, "\n");

  // Summary
  console.log("=" .repeat(80));
  console.log("🎉 DEPLOYMENT SUMMARY");
  console.log("=" .repeat(80));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
  console.log();
  console.log("📋 ERC8004 Registries:");
  console.log("  • IdentityRegistry:    ", identityAddress);
  console.log("  • ReputationRegistry:  ", reputationAddress);
  console.log("  • ValidationRegistry:  ", validationAddress);
  console.log();
  console.log("🤖 Agent Details:");
  console.log("  • Agent ID:            ", agentId.toString());
  console.log("  • Agent Owner:         ", deployer.address);
  console.log("  • YieldRiskAgent:      ", agentContractAddress);
  console.log("  • Service Fee:         ", ethers.formatEther(serviceFee), "ETH");
  console.log("  • Escrow Timeout:      ", escrowTimeout / 3600, "hours");
  console.log();
  console.log("💡 Next Steps:");
  console.log("  1. Update agent metadata URI with actual IPFS content");
  console.log("  2. Off-chain service should monitor ServiceRequested events");
  console.log("  3. Integrate with Gemini API for risk analysis");
  console.log("  4. Call completeService() after analysis is delivered");
  console.log("  5. Clients can give feedback via ReputationRegistry");
  console.log("=" .repeat(80));
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      identityRegistry: identityAddress,
      reputationRegistry: reputationAddress,
      validationRegistry: validationAddress,
      yieldRiskAgent: agentContractAddress,
    },
    agent: {
      id: agentId.toString(),
      owner: deployer.address,
      serviceFee: serviceFee.toString(),
      escrowTimeout: escrowTimeout,
    },
  };

  console.log("📄 Deployment Info (save this):");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

