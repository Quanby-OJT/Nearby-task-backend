import { Request, Response } from "express";
import QTaskPayment from "../models/paymentModel";
import ClientModel from "./clientController";
import { supabase } from "../config/configuration";
import Crypto from "crypto";

class PaymentController {
  static async depositEscrowAmount(req: Request, res: Response): Promise<void> {
      try {
          console.log("Transaction Data: ", req.body);
          const { client_id, amount, payment_method } = req.body;

          if(!payment_method) {
            res.status(400).json({ success: false, error: "Payment method is required." });
            return;
          }

          const fixedPaymentMethod = payment_method.replace(/-/g, "_").toLowerCase();

          const PaymentInformation = await QTaskPayment.checkoutPayment({
              user_id: client_id,
              amount,
              deposit_date: new Date().toISOString(),
              payment_type: "Client Deposit",
              payment_method: fixedPaymentMethod,
          });

          res.status(200).json({
            success: true,
            payment_url: PaymentInformation.checkout_url,
          });
      } catch (error) {
          console.error("Error in depositTaskPayment:", error instanceof Error ? error.message : error);
          res.status(500).json({ success: false, error: "An Error Occured while Processing Your Payment. Please Try Again Later." });
      }
  }
  
  static async displayPaymentLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await QTaskPayment.getPaymentLogsWithUser();
      
      const formattedLogs = logs.map((log: any) => ({
        payment_id: log.transaction_id,
        user_name: `${log.user.first_name} ${log.user.middle_name || ''} ${log.user.last_name}`.trim(), // Fixed: log.user instead of log.clients.user
        amount: log.amount,
        payment_type: log.payment_type,
        created_at: new Date(log.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }),
        transaction_date: new Date(log.transaction_date).toLocaleString("en-US", { timeZone: "Asia/Manila" }), // Fixed: log.transaction_date instead of log.deposit_date
      }));

      res.json(formattedLogs);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An error occured while processing your request. Please Try Again." });
      }
    }
  }

  static async displayPaymentDetails(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const payment_method = req.params.payment_method;

      const paymentDetails = await QTaskPayment.getPaymentDetails(id, payment_method);

      if (!paymentDetails) {
        res.status(404).json({ error: "Payment details not found." });
        return;
      }
      res.status(200).json({payment_details: paymentDetails});
    } catch (error) {
      console.error("Error in displayPaymentDetails:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "An error occured while processing your request. Please Try Again." });
    }
  }

  static async redirectToApplication(req: Request, res: Response): Promise<void> {
    try {
      const { amount, payment_intent_id } = req.params;
      const queryIntentId = req.query.payment_intent_id as string;

      if (payment_intent_id !== queryIntentId) {
        res.status(400).json({ error: "Mismatched payment_intent_id." });
        return;
      }

      const redirectUrl = `myapp://paymongo?amount=${amount}&transaction_id=${payment_intent_id}`;

      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error in redirectToApplication:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "An error occured while processing your request. Please Try Again." });
    }
  }

  static async handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
    try{
      const { amount, success } = req.body;
      const client_id = parseInt(req.params.id);
      const transaction_id = req.params.transaction_id;

      console.log("Payment Data: ", client_id, transaction_id)

      if(success) {
        const {error: loggingError} = await supabase.from("payment_logs")
          .update({
            status: "client_paid"
          })
          .eq("transaction_id", transaction_id)
        if(loggingError) throw new Error(loggingError.message);

        await ClientModel.addCredits(client_id, amount)

        res.status(200).json({ success: true, message: "Your Payment has been Deposited Successfully. You can now create new Tasks." })
        return;
      }else{

      }
    }catch(error){
      console.error("Webhook Error:", error);
      res.status(500).json({ success: false, error: "An error occured while processing your request. Please Try Again." });
    }
  }

  static async withdrawEscrowPayment(req: Request, res: Response): Promise<void> {
    try {
      const { amount, payment_method, account_number, role } = req.body;
      const user_id = parseInt(req.params.id);

      console.log(req.body, "tasker id: ", user_id)

      if (!user_id || !amount || !payment_method || !account_number) {
        res.status(400).json({ error: "All fields are required." });
        return;
      }

      const balance = await QTaskPayment.checkBalance(user_id);

      if(balance.error) {
        res.status(400).json({ error: balance.error });
        return;
      }else if (!balance.amount || balance.amount < 0) {
        const errorMessage = role === "Tasker" ? "Earn More by tasking more tasks" : "Please Deposit Your Amount First.";
        res.status(403).json({ error: "You don't have funds in our system." + errorMessage });
        return;
      }

      if(balance.amount < amount) {
        res.status(400).json({ error: "Insufficient Funds." });
        return;
      }

      await QTaskPayment.releasePayment({
        user_id: user_id,
        amount,
        withdraw_date: new Date().toISOString(),
        payment_type: "QTask Withdrawal",
        payment_method,
        account_no: account_number,
      });
      await QTaskPayment.deductAmountfromUser(role, amount, user_id);

      res.status(200).json({ success: true, message: "Payment Has been withdrawn successfully."});
    } catch (error) {
      console.error("Error in releaseEscrowPayment:", error instanceof Error ? error.message : error);
      res.status(500).json({ success: false, error: "An error occured while processing your request. Please Try Again." });
    }
  }
}

export default PaymentController;