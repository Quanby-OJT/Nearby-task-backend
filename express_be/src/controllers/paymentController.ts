import { Request, Response } from "express";
import PayMongoPayment from "../models/paymentModel";
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

          const PaymentInformation = await PayMongoPayment.checkoutPayment({
              client_id,
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
      const logs = await PayMongoPayment.getPaymentLogsWithUser();
      
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

  static async redirectToApplication(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id, status, amount } = req.body;

      console.log("Redirecting to application with data:", req.body);

      if (!transaction_id || !status) {
        res.status(400).json({ error: "Transaction ID and status are required." });
        return;
      }

      const redirectUrl = `myapp://payment-success?amount=${amount}&transaction_id=${transaction_id}`


      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error in updatePaymentStatus:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }

  static async handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
    try{
      const { amount, success } = req.body;
      const client_id = parseInt(req.params.id);
      const transaction_id = req.params.transaction_id;
      console.log("Received webhook event:", event);

      if(success) {

        const {error: loggingError} = await supabase.from("payment_logs")
          .update({
            status: "client_paid"
          })
          .eq("transaction_id", transaction_id)
          .single();
        if(loggingError) throw new Error(loggingError.message);

        await ClientModel.addCredits(client_id, amount)

        res.status(200).json({ message: "Your Payment has been Deposited Successfully. You can now create new Tasks." })
        return;
      }else{

      }
    }catch(error){
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  static async releaseEscrowPayment(req: Request, res: Response): Promise<void> {
    try {
      const { amount, payment_method, account_number } = req.body;
      const tasker_id = parseInt(req.params.id);
      console.log("Release Payment Data: ", req.body);
      console.log("Tasker ID: ", tasker_id);

      if (!tasker_id || !amount || !payment_method || !account_number) {
        res.status(400).json({ error: "All fields are required." });
        return;
      }    

      // Create a signature for the payment
      const message = JSON.stringify({
          tasker_id,
          amount,
          payment_method,
          account_number
      });
      const hash = Crypto.createHmac("sha256", process.env.NEXTPAY_SECRET_KEY || "")
          .update(message)
          .digest("hex");

      await PayMongoPayment.releasePayment({
        tasker_id,
        amount,
        withdraw_date: new Date().toISOString(),
        payment_type: "Amount Withdraw for Tasker",
        payment_method,
        account_no: account_number,
        signature: hash,
      }
    );

      res.status(200).json({message: "Payment Released Successfully"});
    } catch (error) {
      console.error("Error in releaseEscrowPayment:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
}

export default PaymentController;