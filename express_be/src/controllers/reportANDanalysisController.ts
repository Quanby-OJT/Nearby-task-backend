import { Request, Response } from "express";
import reportANDanalysisModel from "../models/reportANDanalysisModel";

class ReportAnalysisController {
  static async getAllspecialization(req: Request, res: Response) {
    const trendType = req.query.trendType as 'requested' | 'applied' | undefined;
    const month = req.query.month as string | undefined;
    const { rankedSpecializations, monthlyTrends } = await reportANDanalysisModel.getAllspecialization(trendType, month);
    res.status(200).json({
      success: true,
      rankedSpecializations,
      monthlyTrends,
    });
  }

  static async getTopDepositors(req: Request, res: Response) {
    const { rankedDepositors, monthlyTrends } = await reportANDanalysisModel.getTopDepositors();
    res.status(200).json({
      success: true,
      rankedDepositors,
      monthlyTrends,
    });
  }

  static async getTopTasker(req: Request, res: Response) {
    console.log("Tasker data being passed are:" + req.body);
    const { taskers } = await reportANDanalysisModel.getTopTasker();
    res.status(200).json({
      success: true,
      taskers,
    });
  }

  static async getTopClient(req: Request, res: Response) {
    console.log("Client data being passed are:" + req.body);
    const { clients } = await reportANDanalysisModel.getTopClient();
    res.status(200).json({
      success: true,
      clients,
    });
  }

  static async getTaskHistory(req: Request, res: Response) {
    const taskerId = parseInt(req.params.taskerId, 10);
    const taskHistory = await reportANDanalysisModel.getTaskHistory(taskerId);
    res.status(200).json({
      success: true,
      taskHistory,
    });
  }

  static async getClientHistory(req: Request, res: Response) {
    const clientId = parseInt(req.params.clientId, 10);
    const clientHistory = await reportANDanalysisModel.getClientHistory(clientId);
    res.status(200).json({
      success: true,
      clientHistory,
    });
  }
}

export default ReportAnalysisController;