import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config";

export interface RiskAnalysis {
  protocolName: string;
  overallRiskScore: number;
  riskLevel: string;
  analysisSummary: string;
  riskVectors: RiskVector[];
}

export interface RiskVector {
  type: string;
  detail: string;
  severity?: string;
}

export class GeminiRiskAnalyzer {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.geminiModel });
  }

  /**
   * 使用 Gemini API 分析 DeFi 协议风险
   */
  async analyzeProtocol(protocolDescription: string): Promise<RiskAnalysis> {
    console.log("🤖 Analyzing protocol with Gemini API...");

    const prompt = this.buildPrompt(protocolDescription);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log("📄 Raw Gemini response:", text.substring(0, 200) + "...");

      // 解析 JSON 响应
      const analysis = this.parseResponse(text);

      console.log("✅ Analysis completed:", {
        protocolName: analysis.protocolName,
        riskScore: analysis.overallRiskScore,
        riskLevel: analysis.riskLevel,
      });

      return analysis;
    } catch (error) {
      console.error("❌ Gemini API error:", error);
      throw new Error(`Gemini API analysis failed: ${error}`);
    }
  }

  /**
   * 构建发送给 Gemini 的提示词
   */
  private buildPrompt(protocolDescription: string): string {
    return `
You are a world-class DeFi risk analyst and smart contract auditor with expertise in:
- Economic security and game theory
- Smart contract vulnerabilities (reentrancy, oracle manipulation, etc.)
- DeFi protocol design patterns
- Liquidity risks and composability risks
- Centralization and governance risks

Your task is to analyze the following DeFi protocol description and provide a comprehensive risk assessment.

Protocol Description:
"""
${protocolDescription}
"""

Please provide your analysis in the following JSON format (respond with ONLY valid JSON, no markdown):

{
  "protocolName": "Extract or infer the protocol name",
  "overallRiskScore": <number between 0-100, where 100 is highest risk>,
  "riskLevel": "<one of: Low / Medium / High / Critical>",
  "analysisSummary": "<2-3 sentence summary of the overall risk profile>",
  "riskVectors": [
    {
      "type": "Economic Risk",
      "detail": "<Detailed explanation of economic risks: liquidation, oracle manipulation, etc.>",
      "severity": "<Low/Medium/High/Critical>"
    },
    {
      "type": "Smart Contract Risk",
      "detail": "<Detailed explanation of technical/contract risks>",
      "severity": "<Low/Medium/High/Critical>"
    },
    {
      "type": "Centralization Risk",
      "detail": "<Detailed explanation of centralization concerns>",
      "severity": "<Low/Medium/High/Critical>"
    },
    {
      "type": "Composition Risk",
      "detail": "<Detailed explanation of how this protocol depends on others>",
      "severity": "<Low/Medium/High/Critical>"
    }
  ]
}

Risk Score Guidelines:
- 0-25: Low Risk - Well-established protocols with minimal attack surface
- 26-50: Medium Risk - Some concerns but generally safe with proper precautions
- 51-75: High Risk - Multiple significant concerns, use with caution
- 76-100: Critical Risk - Severe issues, strongly advise against usage

Be thorough, specific, and honest. If the description is vague, state what additional information is needed.
`;
  }

  /**
   * 解析 Gemini 的响应
   */
  private parseResponse(text: string): RiskAnalysis {
    try {
      // 尝试提取 JSON（有时 Gemini 会返回 markdown 代码块）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证必需字段
      if (!parsed.protocolName || typeof parsed.overallRiskScore !== "number") {
        throw new Error("Invalid response format");
      }

      return parsed as RiskAnalysis;
    } catch (error) {
      console.error("❌ Failed to parse Gemini response:", error);
      console.error("Raw response:", text);

      // 返回默认的错误响应
      return {
        protocolName: "Unknown Protocol",
        overallRiskScore: 50,
        riskLevel: "Unknown - Analysis Failed",
        analysisSummary:
          "Failed to parse LLM response. Please review the protocol manually.",
        riskVectors: [
          {
            type: "Analysis Error",
            detail: `Could not parse LLM response: ${error}`,
            severity: "High",
          },
        ],
      };
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.model.generateContent("Hello, respond with OK");
      const response = await result.response;
      const text = response.text();
      console.log("✅ Gemini API connection successful:", text);
      return true;
    } catch (error) {
      console.error("❌ Gemini API connection failed:", error);
      return false;
    }
  }
}

