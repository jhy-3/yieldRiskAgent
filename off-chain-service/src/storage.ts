import * as fs from "fs";
import * as path from "path";
import { RiskAnalysis } from "./gemini";

/**
 * 简单的文件存储系统
 * 在生产环境中，应该使用数据库（PostgreSQL, MongoDB等）
 */
export class StorageService {
  private dataDir: string;
  private protocolsFile: string;
  private reportsFile: string;

  constructor() {
    this.dataDir = path.join(__dirname, "../data");
    this.protocolsFile = path.join(this.dataDir, "protocols.json");
    this.reportsFile = path.join(this.dataDir, "reports.json");

    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    console.log("💾 Storage service initialized");
    console.log("   Data directory:", this.dataDir);
  }

  /**
   * 保存协议描述
   */
  saveProtocolDescription(hash: string, description: string): void {
    const protocols = this.loadJSON(this.protocolsFile) || {};
    protocols[hash] = {
      description,
      timestamp: Date.now(),
    };
    this.saveJSON(this.protocolsFile, protocols);
    console.log(`💾 Saved protocol description for hash: ${hash.substring(0, 10)}...`);
  }

  /**
   * 获取协议描述
   */
  getProtocolDescription(hash: string): string | null {
    const protocols = this.loadJSON(this.protocolsFile) || {};
    return protocols[hash]?.description || null;
  }

  /**
   * 保存风险报告
   */
  saveRiskReport(requestId: string, report: RiskAnalysis): string {
    const reports = this.loadJSON(this.reportsFile) || {};
    const reportHash = this.hashReport(report);

    reports[requestId] = {
      report,
      reportHash,
      timestamp: Date.now(),
    };

    this.saveJSON(this.reportsFile, reports);
    console.log(`💾 Saved risk report for request: ${requestId}`);
    console.log(`   Report hash: ${reportHash}`);

    return reportHash;
  }

  /**
   * 获取风险报告
   */
  getRiskReport(requestId: string): RiskAnalysis | null {
    const reports = this.loadJSON(this.reportsFile) || {};
    return reports[requestId]?.report || null;
  }

  /**
   * 获取报告哈希
   */
  getReportHash(requestId: string): string | null {
    const reports = this.loadJSON(this.reportsFile) || {};
    return reports[requestId]?.reportHash || null;
  }

  /**
   * 计算报告的哈希值（用于链上存储）
   */
  private hashReport(report: RiskAnalysis): string {
    const { ethers } = require("ethers");
    const reportString = JSON.stringify(report);
    return ethers.keccak256(ethers.toUtf8Bytes(reportString));
  }

  /**
   * 加载 JSON 文件
   */
  private loadJSON(filePath: string): any {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Failed to load ${filePath}:`, error);
    }
    return null;
  }

  /**
   * 保存 JSON 文件
   */
  private saveJSON(filePath: string, data: any): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error(`Failed to save ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有报告的统计信息
   */
  getStatistics() {
    const reports = this.loadJSON(this.reportsFile) || {};
    const protocols = this.loadJSON(this.protocolsFile) || {};

    return {
      totalReports: Object.keys(reports).length,
      totalProtocols: Object.keys(protocols).length,
      averageRiskScore:
        Object.values(reports).reduce(
          (sum: number, r: any) => sum + (r.report?.overallRiskScore || 0),
          0
        ) / Math.max(Object.keys(reports).length, 1),
    };
  }
}

