import { Request, Response } from "express";
import PayMongoPayment from "../models/paymentModel";
import ClientModel from "./clientController";
import { supabase } from "../config/configuration";

class PaymentController {
    /**
   * The contarct price set by the client will be sent first to Escrow and will be released to the Tasker once the task is completed.
   * 
   * 
   * 
   * How will it work, according to documentation?
   * 
   * 1. If the client and tasker come to the final contract price agreement and the tasker "Confirmed", the client will deposit the amount to Escrow.
   * 2. As the tasker starts the task assigned, the client can monitor it via chat.
   * 3. Once the task is completed, the client will release the amount to the tasker.
   * 4. If the tasker did not complete the task, the client can cancel the task and the amount will be returned to the client.
   * 
   * -Ces
   */
  static async depositEscrowAmount(req: Request, res: Response): Promise<void> {
      try {
          console.log("Transaction Data: ", req.body);
          const { client_id, amount, payment_method } = req.body;

          const fixedPaymentMethod = payment_method.replace(/-/g, "_").toLowerCase();

          const PaymentInformation = await PayMongoPayment.checkoutPayment({
              client_id,
              amount,
              deposit_date: new Date().toISOString(),
              payment_type: "Client Deposit",
              payment_method: fixedPaymentMethod,
          });

          await ClientModel.addCredits(client_id, amount)
  
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

  static async handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
    try{
      const event = req.body.data.attributes
      console.log("Received webhook event:", event);

      if(event.type === "payment.paid") {
        const payment = event.data.attributes;
        const transactionId = payment.checkout_session_id;
        const amount = payment.amount; // Convert to PHP
        const tokens = amount;

        const {data: paymentLog, error: loggingError} = await supabase.from("payment_logs")
          .select("client_id")
          .eq("transaction_id", transactionId)
          .single();
        if(loggingError) throw new Error(loggingError.message);

        const { data: clientData, error: fetchError } = await supabase
          .from("clients")
          .select("amount")
          .eq("client_id", paymentLog.client_id)
          .single();

        if (fetchError || !clientData) {
          throw new Error("Error fetching client data: " + (fetchError?.message || "Client not found"));
        }

        const updatedAmount = clientData.amount + tokens;


        const { error: tokenError } = await supabase
          .from("clients")
          .update({ amount: updatedAmount })
          .eq("client_id", paymentLog.client_id);

        if (tokenError) {
          throw new Error("Error updating client amount: " + tokenError.message);
        }
      }

      res.status(200).json({ message: "Webhook received successfully" })
    }catch(error){
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  static async releaseEscrowPayment(req: Request, res: Response): Promise<void> {
    try {
      const { tasker_id, amount } = req.body;
      const result = await PayMongoPayment.releasePayment({
        tasker_id,
        amount,
        withdraw_date: new Date().toISOString(),
        payment_type: "Amount Withdraw for Tasker",
      });
      res.json(result);
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