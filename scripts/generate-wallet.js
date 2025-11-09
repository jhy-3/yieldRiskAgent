const { ethers } = require("ethers");

const wallet = ethers.Wallet.createRandom();

console.log("=".repeat(60));
console.log("🔐 New Test Wallet Generated");
console.log("=".repeat(60));
console.log("Address:     ", wallet.address);
console.log("Private Key: ", wallet.privateKey);
console.log("Mnemonic:    ", wallet.mnemonic.phrase);
console.log("=".repeat(60));
console.log("\n⚠️  保存这些信息在安全的地方！");
console.log("⚠️  永远不要分享私钥或助记词！");
console.log("⚠️  仅用于测试，不要在主网使用！\n");
