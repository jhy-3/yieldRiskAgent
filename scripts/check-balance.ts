import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("=".repeat(60));
  console.log("💰 Balance Check");
  console.log("=".repeat(60));
  console.log("Address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log();
  
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId.toString());
  console.log();
  
  // Estimate deployment cost
  const estimatedGas = 5000000n; // Rough estimate for all contracts
  const gasPrice = (await ethers.provider.getFeeData()).gasPrice || 0n;
  const estimatedCost = estimatedGas * gasPrice;
  
  console.log("Estimated Deployment Cost:");
  console.log("  Gas:", estimatedGas.toString());
  console.log("  Gas Price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  console.log("  Total:", ethers.formatEther(estimatedCost), "ETH");
  console.log();
  
  if (balance < estimatedCost) {
    console.log("⚠️  WARNING: Insufficient balance for deployment!");
    console.log("   Need at least:", ethers.formatEther(estimatedCost), "ETH");
    console.log("   Current balance:", ethers.formatEther(balance), "ETH");
    console.log("   Shortfall:", ethers.formatEther(estimatedCost - balance), "ETH");
  } else {
    console.log("✅ Sufficient balance for deployment");
    console.log("   Remaining after deployment:", ethers.formatEther(balance - estimatedCost), "ETH");
  }
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

