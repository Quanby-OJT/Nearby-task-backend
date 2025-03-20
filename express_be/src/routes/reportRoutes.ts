// reportRoute.ts
import { Router } from "express";
import ReportController from "../controllers/reportController";

const router = Router();

// Route to submit a report
router.post("/reports", ReportController.uploadReportImages, ReportController.createReport);

export default router;