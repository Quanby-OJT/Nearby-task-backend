import { Router } from "express";
import ReportController from "../controllers/reportController";

const router = Router();

// Mobile or Client and Tasker Side
router.post("/reports", ReportController.uploadReportImages, ReportController.createReport);
router.get("/clients", ReportController.getAllClients);
router.get("/reportHistory", ReportController.getReportHistory)

// Website or Moderator and Admin Side
router.get("/getReports", ReportController.getAllReports);
router.patch("/reports/:reportId", ReportController.updateReportStatus); 

export default router;