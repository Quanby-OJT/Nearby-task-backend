import { Router } from "express";
import ReportController from "../controllers/reportController";

const router = Router();

router.post("/reports", ReportController.uploadReportImages, ReportController.createReport);
router.get("/taskers", ReportController.getAllTaskers); // Existing route for taskers
router.get("/clients", ReportController.getAllClients); // New route for clients

export default router;