import { Router } from "express";
import ReportController from "../controllers/reportController";

const router = Router();


// Mobile or Client and Tasker Side
router.post("/reports", ReportController.uploadReportImages, ReportController.createReport);
router.get("/taskers", ReportController.getAllTaskers); 
router.get("/clients", ReportController.getAllClients);

// Website or Moderator and Admin Side
router.get("/getReports", ReportController.getAllReports);


export default router;