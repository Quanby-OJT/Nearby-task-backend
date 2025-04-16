import { Router } from "express";
import ReportAnalysisController from "../controllers/reportANDanalysisController";

const router = Router();

router.get("/getReportAnalysisSpecialization", ReportAnalysisController.getAllspecialization);
router.get("/getTopDepositors", ReportAnalysisController.getTopDepositors);

export default router;