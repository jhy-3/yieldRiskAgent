import express, { Request, Response } from "express";
import cors from "cors";
import { config } from "./config";
import { StorageService } from "./storage";

export class APIService {
  private app: express.Application;
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.app = express();
    this.storage = storage;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes() {
    // 健康检查
    this.app.get("/health", (req: Request, res: Response) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    // 提交协议描述（客户端在请求服务前调用）
    this.app.post("/protocol", (req: Request, res: Response) => {
      const { description } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      const { ethers } = require("ethers");
      const hash = ethers.keccak256(ethers.toUtf8Bytes(description));

      this.storage.saveProtocolDescription(hash, description);

      res.json({
        success: true,
        hash,
        message: "Protocol description saved. Use this hash when calling requestService().",
      });
    });

    // 获取风险报告
    this.app.get("/report/:requestId", (req: Request, res: Response) => {
      const { requestId } = req.params;
      const report = this.storage.getRiskReport(requestId);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      res.json({
        success: true,
        requestId,
        report,
        reportHash: this.storage.getReportHash(requestId),
      });
    });

    // 获取统计信息
    this.app.get("/stats", (req: Request, res: Response) => {
      const stats = this.storage.getStatistics();
      res.json({ success: true, stats });
    });

    // 404 处理
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: "Endpoint not found" });
    });
  }

  start() {
    this.app.listen(config.port, () => {
      console.log(`\n🌐 API server running on http://localhost:${config.port}`);
      console.log(`   Health: http://localhost:${config.port}/health`);
      console.log(`   Submit protocol: POST http://localhost:${config.port}/protocol`);
      console.log(`   Get report: GET http://localhost:${config.port}/report/:requestId`);
      console.log(`   Statistics: GET http://localhost:${config.port}/stats`);
    });
  }
}

