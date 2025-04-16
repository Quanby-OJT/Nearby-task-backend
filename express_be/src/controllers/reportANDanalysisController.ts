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
    const { taskers } = await reportANDanalysisModel.getTopTasker();
    res.status(200).json({
      success: true,
      taskers,
    });
  }
}

export default ReportAnalysisController;