import { Request, Response } from "express";
import reportANDanalysisModel from "../models/reportANDanalysisModel";

class ReportAnalysisController {
  static async getAllspecialization(req: Request, res: Response) {
    try {
      const { rankedSpecializations, monthlyTrends } = await reportANDanalysisModel.getAllspecialization();
      res.status(200).json({
        success: true,
        rankedSpecializations,
        monthlyTrends,
      });
    } catch (error) {
      console.error("Failed to fetch specialization: ", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown Error Occurred",
      });
    }
  }

  static async getAlltasker(req: Request, res: Response) {
    try {
      const tasker = await reportANDanalysisModel.getAlltasker();
    } catch (error) {
      console.error("Failed to fetch taskers: ", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown Error Occurred",
      });
    }
  }
}

export default ReportAnalysisController;