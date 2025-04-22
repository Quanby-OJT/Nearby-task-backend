import { Router } from "express";
import PaymentController from "../controllers/paymentController";

const router = Router();

router.get("/displayPaymentLogs", PaymentController.displayPaymentLogs);

export default router;