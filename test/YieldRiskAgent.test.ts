import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { IdentityRegistry, ReputationRegistry, ValidationRegistry, YieldRiskAgent } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("YieldRiskAgent - Complete ERC8004 Integration", function () {
  let identityRegistry: IdentityRegistry;
  let reputationRegistry: ReputationRegistry;
  let validationRegistry: ValidationRegistry;
  let yieldRiskAgent: YieldRiskAgent;
  
  let owner: SignerWithAddress;
  let client1: SignerWithAddress;
  let client2: SignerWithAddress;
  let validator: SignerWithAddress;
  
  let agentId: bigint;
  const serviceFee = ethers.parseEther("0.001");
  const escrowTimeout = 24 * 60 * 60; // 24 hours

  beforeEach(async function () {
    [owner, client1, client2, validator] = await ethers.getSigners();

    // Deploy ERC8004 registries
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistry.deploy();
    await identityRegistry.waitForDeployment();

    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistry.deploy(await identityRegistry.getAddress());
    await reputationRegistry.waitForDeployment();

    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistry.deploy(await identityRegistry.getAddress());
    await validationRegistry.waitForDeployment();

    // Register agent
    const agentMetadataUri = "ipfs://QmAegisAgentMetadata";
    const tx = await identityRegistry["register(string)"](agentMetadataUri);
    const receipt = await tx.wait();
    
    // Extract agentId from event
    const event = receipt?.logs.find((log: any) => {
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

    if (event) {
      const parsed = identityRegistry.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });
      agentId = parsed?.args?.agentId;
    }

    // Deploy YieldRiskAgent
    const YieldRiskAgent = await ethers.getContractFactory("YieldRiskAgent");
    yieldRiskAgent = await YieldRiskAgent.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      agentId,
      serviceFee,
      escrowTimeout
    );
    await yieldRiskAgent.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      expect(await identityRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await reputationRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await validationRegistry.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await yieldRiskAgent.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should register agent with correct owner", async function () {
      expect(await identityRegistry.ownerOf(agentId)).to.equal(owner.address);
      expect(await yieldRiskAgent.agentOwner()).to.equal(owner.address);
      expect(await yieldRiskAgent.agentId()).to.equal(agentId);
    });

    it("Should set correct service parameters", async function () {
      expect(await yieldRiskAgent.serviceFee()).to.equal(serviceFee);
      expect(await yieldRiskAgent.escrowTimeout()).to.equal(escrowTimeout);
    });
  });

  describe("Service Request Flow", function () {
    it("Should allow client to request service", async function () {
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol"));
      
      await expect(
        yieldRiskAgent.connect(client1).requestService(protocolHash, { value: serviceFee })
      )
        .to.emit(yieldRiskAgent, "ServiceRequested")
        .withArgs(0, client1.address, serviceFee, protocolHash);

      const request = await yieldRiskAgent.getRequestDetails(0);
      expect(request[0]).to.equal(client1.address);
      expect(request[1]).to.equal(serviceFee);
      expect(request[3]).to.equal(false); // not completed
      expect(request[4]).to.equal(false); // not refunded
    });

    it("Should reject request with insufficient payment", async function () {
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol"));
      const lowFee = ethers.parseEther("0.0001");
      
      await expect(
        yieldRiskAgent.connect(client1).requestService(protocolHash, { value: lowFee })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should reject request with invalid hash", async function () {
      await expect(
        yieldRiskAgent.connect(client1).requestService(ethers.ZeroHash, { value: serviceFee })
      ).to.be.revertedWith("Invalid description hash");
    });

    it("Should track multiple requests", async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("Protocol 1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("Protocol 2"));
      
      await yieldRiskAgent.connect(client1).requestService(hash1, { value: serviceFee });
      await yieldRiskAgent.connect(client2).requestService(hash2, { value: serviceFee });

      const stats = await yieldRiskAgent.getStatistics();
      expect(stats[0]).to.equal(2); // totalRequests
    });
  });

  describe("Service Completion", function () {
    beforeEach(async function () {
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol"));
      await yieldRiskAgent.connect(client1).requestService(protocolHash, { value: serviceFee });
    });

    it("Should allow agent owner to complete service", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report"));
      
      await expect(yieldRiskAgent.connect(owner).completeService(0, reportHash))
        .to.emit(yieldRiskAgent, "ServiceCompleted")
        .withArgs(0, reportHash);

      const request = await yieldRiskAgent.getRequestDetails(0);
      expect(request[3]).to.equal(true); // completed
    });

    it("Should reject completion by non-owner", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report"));
      
      await expect(
        yieldRiskAgent.connect(client1).completeService(0, reportHash)
      ).to.be.revertedWith("Not agent owner");
    });

    it("Should reject completion with invalid report hash", async function () {
      await expect(
        yieldRiskAgent.connect(owner).completeService(0, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid report hash");
    });

    it("Should reject double completion", async function () {
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report"));
      await yieldRiskAgent.connect(owner).completeService(0, reportHash);
      
      await expect(
        yieldRiskAgent.connect(owner).completeService(0, reportHash)
      ).to.be.revertedWith("Request already completed");
    });
  });

  describe("Escrow Management", function () {
    it("Should release escrow to agent after timeout", async function () {
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol"));
      await yieldRiskAgent.connect(client1).requestService(protocolHash, { value: serviceFee });
      
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report"));
      await yieldRiskAgent.connect(owner).completeService(0, reportHash);

      // Fast forward time
      await time.increase(escrowTimeout + 1);

      const balanceBefore = await ethers.provider.getBalance(owner.address);
      
      await expect(yieldRiskAgent.releaseEscrow(0))
        .to.emit(yieldRiskAgent, "EscrowReleased")
        .withArgs(0, owner.address, serviceFee, false);

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);

      const stats = await yieldRiskAgent.getStatistics();
      expect(stats[1]).to.equal(serviceFee); // totalEarned
    });

    it("Should reject escrow release before timeout", async function () {
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol 2"));
      await yieldRiskAgent.connect(client1).requestService(protocolHash, { value: serviceFee });
      
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report 2"));
      await yieldRiskAgent.connect(owner).completeService(1, reportHash);

      await expect(yieldRiskAgent.releaseEscrow(1))
        .to.be.revertedWith("Escrow timeout not reached");
    });

    it("Should handle timeout and manual release", async function () {
      // Create request
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol Timeout"));
      await yieldRiskAgent.connect(client2).requestService(protocolHash, { value: serviceFee });
      
      // Get the request ID from stats
      const stats = await yieldRiskAgent.getStatistics();
      const requestId = Number(stats[0]) - 1; // Last request ID
      
      // Complete service first
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report Timeout"));
      await yieldRiskAgent.connect(owner).completeService(requestId, reportHash);
      
      // Fast forward time past timeout
      await time.increase(escrowTimeout + 1);
      
      // Now release escrow after timeout
      await expect(yieldRiskAgent.releaseEscrow(requestId))
        .to.emit(yieldRiskAgent, "EscrowReleased");
    });
  });

  describe("Reputation Integration", function () {
    let feedbackAuth: string;

    beforeEach(async function () {
      // Request and complete service
      const protocolHash = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol"));
      await yieldRiskAgent.connect(client1).requestService(protocolHash, { value: serviceFee });
      
      const reportHash = ethers.keccak256(ethers.toUtf8Bytes("Risk Report"));
      await yieldRiskAgent.connect(owner).completeService(0, reportHash);

      // Create feedback authorization
      const latestBlock = await ethers.provider.getBlock("latest");
      const auth = {
        agentId: agentId,
        clientAddress: client1.address,
        indexLimit: 1,
        expiry: latestBlock!.timestamp + 86400,
        chainId: (await ethers.provider.getNetwork()).chainId,
        identityRegistry: await identityRegistry.getAddress(),
        signerAddress: owner.address
      };

      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint64", "uint256", "uint256", "address", "address"],
        [auth.agentId, auth.clientAddress, auth.indexLimit, auth.expiry, auth.chainId, auth.identityRegistry, auth.signerAddress]
      );

      const messageHash = ethers.keccak256(encoded);
      const signature = await owner.signMessage(ethers.getBytes(messageHash));
      feedbackAuth = encoded + signature.slice(2);
    });

    it("Should allow client to give good feedback", async function () {
      const feedbackScore = 95;
      const tag1 = ethers.encodeBytes32String("HighAccuracy");
      const tag2 = ethers.encodeBytes32String("FastResponse");
      const feedbackUri = "ipfs://QmFeedback";
      const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes("Great!"));

      await expect(
        reputationRegistry.connect(client1).giveFeedback(
          agentId, feedbackScore, tag1, tag2, feedbackUri, feedbackHash, feedbackAuth
        )
      ).to.emit(reputationRegistry, "NewFeedback");

      const reputation = await yieldRiskAgent.getReputationSummary();
      expect(reputation[0]).to.equal(1); // count
      expect(reputation[1]).to.equal(feedbackScore); // average score
    });

    it("Should allow client to give bad feedback and request refund", async function () {
      // Create new request for this test
      const protocolHash2 = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol Bad"));
      await yieldRiskAgent.connect(client2).requestService(protocolHash2, { value: serviceFee });
      
      const stats = await yieldRiskAgent.getStatistics();
      const requestId = Number(stats[0]) - 1;
      
      const reportHash2 = ethers.keccak256(ethers.toUtf8Bytes("Risk Report Bad"));
      await yieldRiskAgent.connect(owner).completeService(requestId, reportHash2);

      // Create feedback authorization for client2
      const latestBlock2 = await ethers.provider.getBlock("latest");
      const auth2 = {
        agentId: agentId,
        clientAddress: client2.address,
        indexLimit: 1,
        expiry: latestBlock2!.timestamp + 86400,
        chainId: (await ethers.provider.getNetwork()).chainId,
        identityRegistry: await identityRegistry.getAddress(),
        signerAddress: owner.address
      };

      const encoded2 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint64", "uint256", "uint256", "address", "address"],
        [auth2.agentId, auth2.clientAddress, auth2.indexLimit, auth2.expiry, auth2.chainId, auth2.identityRegistry, auth2.signerAddress]
      );

      const messageHash2 = ethers.keccak256(encoded2);
      const signature2 = await owner.signMessage(ethers.getBytes(messageHash2));
      const feedbackAuth2 = encoded2 + signature2.slice(2);

      const feedbackScore = 20; // Bad score
      const tag1 = ethers.encodeBytes32String("LowAccuracy");
      const tag2 = ethers.encodeBytes32String("SlowResponse");
      const feedbackUri = "ipfs://QmBadFeedback";
      const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes("Poor analysis"));

      // Give bad feedback
      await reputationRegistry.connect(client2).giveFeedback(
        agentId, feedbackScore, tag1, tag2, feedbackUri, feedbackHash, feedbackAuth2
      );

      // Request refund
      const balanceBefore = await ethers.provider.getBalance(client2.address);
      
      await expect(yieldRiskAgent.connect(client2).refundOnBadFeedback(requestId, feedbackScore))
        .to.emit(yieldRiskAgent, "EscrowReleased")
        .withArgs(requestId, client2.address, serviceFee, true);

      const balanceAfter = await ethers.provider.getBalance(client2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should reject refund with high feedback score", async function () {
      // Create new request for this test  
      const protocolHash3 = ethers.keccak256(ethers.toUtf8Bytes("Test Protocol Good"));
      await yieldRiskAgent.connect(client1).requestService(protocolHash3, { value: serviceFee });
      
      const stats = await yieldRiskAgent.getStatistics();
      const requestId = Number(stats[0]) - 1;
      
      const reportHash3 = ethers.keccak256(ethers.toUtf8Bytes("Risk Report Good"));
      await yieldRiskAgent.connect(owner).completeService(requestId, reportHash3);

      // Create feedback authorization for this request
      const latestBlock3 = await ethers.provider.getBlock("latest");
      const auth3 = {
        agentId: agentId,
        clientAddress: client1.address,
        indexLimit: 2, // Need higher limit since client1 may have given feedback before
        expiry: latestBlock3!.timestamp + 86400,
        chainId: (await ethers.provider.getNetwork()).chainId,
        identityRegistry: await identityRegistry.getAddress(),
        signerAddress: owner.address
      };

      const encoded3 = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint64", "uint256", "uint256", "address", "address"],
        [auth3.agentId, auth3.clientAddress, auth3.indexLimit, auth3.expiry, auth3.chainId, auth3.identityRegistry, auth3.signerAddress]
      );

      const messageHash3 = ethers.keccak256(encoded3);
      const signature3 = await owner.signMessage(ethers.getBytes(messageHash3));
      const feedbackAuth3 = encoded3 + signature3.slice(2);

      const feedbackScore = 80; // Good score
      const tag1 = ethers.encodeBytes32String("HighAccuracy");
      const tag2 = ethers.ZeroHash;
      const feedbackUri = "ipfs://QmFeedback";
      const feedbackHash = ethers.keccak256(ethers.toUtf8Bytes("Good"));

      await reputationRegistry.connect(client1).giveFeedback(
        agentId, feedbackScore, tag1, tag2, feedbackUri, feedbackHash, feedbackAuth3
      );

      await expect(
        yieldRiskAgent.connect(client1).refundOnBadFeedback(requestId, feedbackScore)
      ).to.be.revertedWith("Feedback score too high for refund");
    });

    it("Should prevent self-feedback from agent owner", async function () {
      // Try to create feedback from owner (should fail)
      const auth = {
        agentId: agentId,
        clientAddress: owner.address,
        indexLimit: 1,
        expiry: Math.floor(Date.now() / 1000) + 86400,
        chainId: (await ethers.provider.getNetwork()).chainId,
        identityRegistry: await identityRegistry.getAddress(),
        signerAddress: owner.address
      };

      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint64", "uint256", "uint256", "address", "address"],
        [auth.agentId, auth.clientAddress, auth.indexLimit, auth.expiry, auth.chainId, auth.identityRegistry, auth.signerAddress]
      );

      const messageHash = ethers.keccak256(encoded);
      const signature = await owner.signMessage(ethers.getBytes(messageHash));
      const ownerFeedbackAuth = encoded + signature.slice(2);

      await expect(
        reputationRegistry.connect(owner).giveFeedback(
          agentId, 100, ethers.ZeroHash, ethers.ZeroHash, "", ethers.ZeroHash, ownerFeedbackAuth
        )
      ).to.be.revertedWith("Self-feedback not allowed");
    });
  });

  describe("Validation Registry Integration", function () {
    it("Should allow agent owner to request validation", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("Validation Request"));
      const requestUri = "ipfs://QmValidationRequest";

      await expect(
        validationRegistry.connect(owner).validationRequest(
          validator.address, agentId, requestUri, requestHash
        )
      ).to.emit(validationRegistry, "ValidationRequest");
    });

    it("Should allow validator to respond", async function () {
      const requestHash = ethers.keccak256(ethers.toUtf8Bytes("Validation Request"));
      const requestUri = "ipfs://QmValidationRequest";

      await validationRegistry.connect(owner).validationRequest(
        validator.address, agentId, requestUri, requestHash
      );

      const response = 95;
      const responseUri = "ipfs://QmValidationResponse";
      const responseHash = ethers.keccak256(ethers.toUtf8Bytes("Uptime: 99.9%"));
      const tag = ethers.encodeBytes32String("Uptime");

      await expect(
        validationRegistry.connect(validator).validationResponse(
          requestHash, response, responseUri, responseHash, tag
        )
      ).to.emit(validationRegistry, "ValidationResponse");

      const status = await validationRegistry.getValidationStatus(requestHash);
      expect(status[2]).to.equal(response);
    });
  });

  describe("Agent Configuration", function () {
    it("Should allow owner to update service fee", async function () {
      const newFee = ethers.parseEther("0.002");
      
      await expect(yieldRiskAgent.connect(owner).updateServiceFee(newFee))
        .to.emit(yieldRiskAgent, "FeeUpdated")
        .withArgs(serviceFee, newFee);

      expect(await yieldRiskAgent.serviceFee()).to.equal(newFee);
    });

    it("Should reject fee update from non-owner", async function () {
      const newFee = ethers.parseEther("0.002");
      
      await expect(
        yieldRiskAgent.connect(client1).updateServiceFee(newFee)
      ).to.be.revertedWith("Not agent owner");
    });

    it("Should allow owner to update escrow timeout", async function () {
      const newTimeout = 48 * 60 * 60; // 48 hours
      
      await expect(yieldRiskAgent.connect(owner).updateEscrowTimeout(newTimeout))
        .to.emit(yieldRiskAgent, "TimeoutUpdated")
        .withArgs(escrowTimeout, newTimeout);

      expect(await yieldRiskAgent.escrowTimeout()).to.equal(newTimeout);
    });

    it("Should reject invalid timeout", async function () {
      const tooShort = 30 * 60; // 30 minutes
      const tooLong = 8 * 24 * 60 * 60; // 8 days
      
      await expect(
        yieldRiskAgent.connect(owner).updateEscrowTimeout(tooShort)
      ).to.be.revertedWith("Invalid timeout");

      await expect(
        yieldRiskAgent.connect(owner).updateEscrowTimeout(tooLong)
      ).to.be.revertedWith("Invalid timeout");
    });
  });

  describe("Statistics and Reporting", function () {
    it("Should track comprehensive statistics", async function () {
      // Create multiple requests
      for (let i = 0; i < 3; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`Protocol ${i}`));
        await yieldRiskAgent.connect(client1).requestService(hash, { value: serviceFee });
      }

      const stats = await yieldRiskAgent.getStatistics();
      expect(stats[0]).to.equal(3); // totalRequests
      expect(stats[3]).to.equal(serviceFee * 3n); // activeEscrow
    });

    it("Should return correct agent identity metadata", async function () {
      const totalAgents = await identityRegistry.totalAgents();
      expect(totalAgents).to.be.gt(0);

      const agentOwnerFromRegistry = await identityRegistry.ownerOf(agentId);
      expect(agentOwnerFromRegistry).to.equal(owner.address);
    });
  });
});

