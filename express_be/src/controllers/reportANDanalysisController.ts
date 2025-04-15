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
}

export default ReportAnalysisController;