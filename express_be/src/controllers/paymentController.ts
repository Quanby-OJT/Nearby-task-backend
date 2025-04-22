import { Request, Response } from "express";
import PaymentModel from "../models/paymentModel";

class PaymentController {
  static async displayPaymentLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await PaymentModel.getPaymentLogsWithUser();
      
      const formattedLogs = logs.map((log: any) => ({
        payment_id: log.transaction_id,
        user_name: `${log.clients.user.first_name} ${log.clients.user.middle_name || ''} ${log.clients.user.last_name}`.trim(),
        amount: log.amount,
        payment_type: log.payment_type,
        created_at: new Date(log.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }),
        deposit_date: new Date(log.deposit_date).toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      }));

      res.json(formattedLogs);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }
}

export default PaymentController;