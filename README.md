# Aegis YieldRiskAgent: An ERC-8004 Implementation for DeFi Risk Assessment

**A Production-Ready Smart Contract System for Trustless AI-Powered Risk Analysis**

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22.0-yellow)](https://hardhat.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![ERC-8004](https://img.shields.io/badge/ERC-8004-purple)](https://eips.ethereum.org/EIPS/eip-8004)

---

> 🛡️ **Security Note:** All environment files and documentation now use placeholder API keys and private keys. Replace them with your own credentials before deployment.

## Executive Summary

The **Aegis YieldRiskAgent** is a complete, auditable implementation of the ERC-8004 "Trustless Agents" standard, specifically engineered to address the critical challenge of opaque risk in decentralized finance (DeFi) yield protocols. This project demonstrates how blockchain-native identity, reputation, and validation mechanisms can be combined with large language model (LLM) inference to create an autonomous, economically-incentivized risk assessment service.

### Core Innovation: Reputation-as-Stake Economic Model

Traditional off-chain risk analysis services suffer from a fundamental trust problem: there is no direct, enforceable link between service quality and economic consequences. This implementation solves this through a novel "Reputation-as-Stake" model where:

1. **Payment is Escrowed**: Client fees are locked in a smart contract, not immediately transferred to the agent
2. **Feedback Drives Settlement**: High-quality service (validated via on-chain feedback) releases payment; poor service triggers automatic refunds
3. **Reputation is Capital**: An agent's historical reputation score directly determines its future earning potential and market positioning

This architecture transforms ERC-8004's reputation registry from a passive scoreboard into an active economic enforcement mechanism.

---

## Part I: Project Architecture and Technical Foundations

### 1.1 The DeFi Risk Assessment Problem

The decentralized finance ecosystem has experienced explosive growth, with total value locked (TVL) reaching hundreds of billions of dollars across thousands of protocols. However, this growth has been accompanied by a proliferation of complex, often opaque risk vectors:

- **Economic Risks**: Liquidation cascades, oracle manipulation, impermanent loss amplification
- **Smart Contract Risks**: Unaudited code, upgrade keys, reentrancy vulnerabilities
- **Composition Risks**: Multi-protocol dependencies creating systemic failure modes
- **Governance Risks**: Centralized admin keys, malicious proposal attacks

While advertised APYs are prominently displayed, the associated risks are often buried in technical documentation or entirely undisclosed. Manual analysis by human experts does not scale to the 24/7, millisecond-response environment of DeFi markets. An autonomous, verifiable, and economically-accountable agent system is required.

### 1.2 Why ERC-8004: The Standard for Trustless Agents

ERC-8004, officially titled "Trustless Agents," establishes a standardized protocol for creating discoverable, verifiable, and reputation-bound autonomous agents on Ethereum-compatible blockchains. The standard defines three core registries:

#### **Identity Registry** (ERC-721 NFT)
- Each agent is a unique, transferable NFT
- On-chain metadata defines capabilities, endpoints, and service specifications
- Enables programmatic agent discovery and integration

#### **Reputation Registry** (Feedback System)
- Clients submit cryptographically-signed feedback after service consumption
- Feedback is immutably recorded on-chain with scores (0-100) and semantic tags
- Anti-sybil protections prevent self-feedback and gaming
- Provides verifiable service history for due diligence

#### **Validation Registry** (Objective Metrics)
- External validators submit objective performance metrics (e.g., uptime, response time)
- Complements subjective client feedback with measurable QoS data
- Creates a dual-layer trust mechanism (subjective + objective)

By implementing ERC-8004, Aegis YieldRiskAgent becomes interoperable with any future agent marketplace, DAO governance system, or automated risk management protocol that adopts the standard.

### 1.3 System Architecture: On-Chain Coordination + Off-Chain LLM Inference

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT / USER                           │
│         (Individual, DAO Treasury, Yield Aggregator)            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ 1. requestService() + payment (0.001 ETH)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    YieldRiskAgent.sol                           │
│              (Service Coordinator + Escrow Manager)             │
│                                                                 │
│  • Locks payment in escrow                                      │
│  • Emits ServiceRequested event                                 │
│  • Manages feedback-driven settlement                           │
└────────┬────────────────────────────────────┬──────────────────┘
         │                                    │
         │ 2. Event monitoring                │ 3. Reputation query
         ↓                                    ↓
┌──────────────────────┐          ┌────────────────────────────┐
│   Off-Chain Service  │          │   ReputationRegistry.sol   │
│      (Node.js)       │          │   (On-Chain Trust Layer)   │
│                      │          │                            │
│  • Listens for       │          │  • giveFeedback()          │
│    ServiceRequested  │          │  • getSummary()            │
│  • Calls LLM API     │          │  • Cryptographic           │
│    (GPT-4o-mini)     │          │    signature verification  │
│  • Submits report    │          └────────────────────────────┘
│    hash on-chain     │                      ↑
└──────────────────────┘                      │
         │                                    │
         │ 4. completeService()               │
         │    with report hash                │
         └────────────────────────────────────┘
                         5. Client submits feedback
                            → Settlement triggered
```

**Key Design Principle**: The blockchain serves as a trustless coordination layer and economic enforcement mechanism, while computationally-expensive LLM inference occurs off-chain for cost efficiency. The integrity of the off-chain service is ensured through the economic incentive structure, not through on-chain computation.

---

## Environment Configuration

- **Toolchain requirements**
  - `Node.js >= 18` and `npm >= 9` (Hardhat 2.22 runs on this toolchain). Verify with `node -v` / `npm -v`.
  - Install Hardhat CLI if you prefer a global binary: `npm install --global hardhat`. Otherwise rely on the local `npx hardhat`.
  - `Python >= 3.10` with `pip` for auxiliary analytics scripts or notebook experiments. Create an isolated environment with `python3 -m venv .venv && source .venv/bin/activate`.
  - (Optional) Install commonly used Python packages after activating the venv: `pip install web3 pytest`.

- Copy `off-chain-service/.env.example` to `off-chain-service/.env` and update each placeholder with your own credentials.
- Provide an Ethereum private key funded on the network you plan to deploy to, plus an RPC endpoint URL.
- Configure the LLM proxy credentials that power the off-chain analysis service.
- Copy `off-chain-service/.env.example` to `off-chain-service/.env` and update each placeholder with your own credentials.
- Provide an Ethereum private key funded on the network you plan to deploy to, plus an RPC endpoint URL.
- Configure the LLM proxy credentials that power the off-chain analysis service.

```bash
# off-chain-service/.env (example)
LLM_API_KEY=sk-your-api-key
LLM_BASE_URL=https://api.chatanywhere.tech/v1
LLM_MODEL=gpt-4o-mini

PRIVATE_KEY=0xYourPrivateKey
RPC_URL=http://127.0.0.1:9545
CHAIN_ID=31337
YIELD_RISK_AGENT_ADDRESS=0xDeployedContractAddress

PORT=3001
LOG_LEVEL=info
```

- Confirm that `.env` files remain ignored by Git via the provided `.gitignore`.

## Basic Usage

- Install dependencies in the project root: `npm install`.
- Compile the smart contracts: `npm run compile`.
- Start a local Hardhat node in another terminal: `npm run node`.
- Deploy the contracts against that node: `npm run deploy:local`.
- Run the off-chain service:
  - `cd off-chain-service`
  - `npm install`
  - Update `.env`
  - `npm start`
- Submit a protocol description through the off-chain HTTP API, call `requestService` on-chain, and observe the agent completing the workflow end-to-end.

## Sample Interaction

- **User question**
  ```
  “Please evaluate the USDC/DAI lending pool on Aave V3 (Base network). Highlight liquidation, oracle, and governance risks.”
  ```

- **Agent reply (abridged)**
  ```json
  {
    "protocolName": "Aave V3 – Base USDC/DAI Pool",
    "overallRiskScore": 37,
    "riskLevel": "Medium",
    "analysisSummary": "Blue-chip lending market with mature tooling and active governance. Primary concerns are cascading liquidations during sharp USDC depegs and oracle dependency on Chainlink feeds.",
    "riskVectors": [
      {
        "type": "Economic Risk",
        "detail": "If USDC briefly depegs, concentrated stablecoin positions could see rapid liquidations, amplifying losses.",
        "severity": "Medium"
      },
      {
        "type": "Smart Contract Risk",
        "detail": "Core contracts are audited and widely used; remaining exposure is limited to upgrade proxies and bridge adapters.",
        "severity": "Low"
      },
      {
        "type": "Centralization Risk",
        "detail": "Emergency admins can pause markets; governance multisig still required for rapid responses.",
        "severity": "Medium"
      }
    ],
    "recommendations": [
      "Monitor Chainlink oracle health and redundancy.",
      "Set conservative health factors for large stablecoin borrowers.",
      "Track governance proposals that modify LTV or liquidation thresholds."
    ]
  }
  ```
