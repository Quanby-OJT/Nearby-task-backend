import { Router } from "express";
import ReportController from "../controllers/reportController";

const router = Router();

router.post("/reports", ReportController.uploadReportImages, ReportController.createReport);
router.get("/taskers", ReportController.getAllTaskers); // New route

export default router;