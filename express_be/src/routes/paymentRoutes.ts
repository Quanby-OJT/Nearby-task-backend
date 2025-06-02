import { Router } from "express";
import PaymentController from "../controllers/paymentController";

const router = Router();

//Payment Routes
router.post("/deposit-escrow-payment", PaymentController.depositEscrowAmount);
router.get("/get-payment-logs/:id/:payment_method", PaymentController.displayPaymentDetails);
router.post("/withdraw-escrow-amount/:id", PaymentController.withdrawEscrowPayment);
router.get("/displayPaymentLogs", PaymentController.displayPaymentLogs);

export default router;