import { Router } from "express";
import ReportAnalysisController from "../controllers/reportANDanalysisController";

const router = Router();

router.get("/getReportAnalysisSpecialization", ReportAnalysisController.getAllspecialization);
router.get("/getReportAnalysisAlltasker", ReportAnalysisController.getAlltasker);

export default router;