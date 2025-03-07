import { Router } from "express";
import UserLogsController from "../controllers/userlogController";

const router = Router();

router.get("/displayLogs", UserLogsController.displayLogs);

export default router;
