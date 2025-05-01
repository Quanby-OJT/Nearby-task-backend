import {Request, Response} from "express";
import { supabase } from "../config/configuration";
import taskModel from "./taskModel";

interface Payment {
  payment_history_id?: number;
  client_id?: number;
  transaction_id?: string;
  amount: number;
  deposit_date: string;
  payment_type: string;
  task_taken_id?: number;
}

// Updated to match PayMongo's checkout_sessions response structure
interface PayMongoResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      billing: object;
      checkout_url: string;
      client_key: string;
      description: string;
      line_items: Array<object>;
      payment_method_types: string[];
      status: string; 
      send_email_receipt: boolean;
      show_description: boolean;
      show_line_items: boolean;
      created_at: number;
      updated_at: number;
    };
  };
  errors?: Array<{ detail: string }>; // For error cases
}

//TODO: Implement XENDIT API response structure

class PayMongoPayment {
  static async checkoutPayment(paymentInfo: Payment) {
    interface UserEmailResponse {
      user: { 
        first_name: string, 
        middle_name: string, 
        last_name: string 
        email: string,
        contact: string
      }
    }

    // Fetch user and task data from Supabase
    const { data: userEmailResponse, error: emailError } = await supabase
      .from("clients")
      .select("user(first_name, middle_name, last_name, email, contact)")
      .eq("client_id", paymentInfo.client_id)
      .single() as { data: UserEmailResponse | null; error: any };

    if (emailError || !userEmailResponse) throw new Error(emailError.message || "Failed to fetch user email data");
    console.log("User Email Response:", userEmailResponse);

    const clientName = `${userEmailResponse.user.first_name} ${userEmailResponse.user.middle_name} ${userEmailResponse.user.last_name}`;

    // PayMongo auth (only secret key needed, not duplicated)
    const authString = `${process.env.PAYMONGO_SECRET_KEY}:`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    // PayMongo checkout session payload
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              address: {
                line1: "4th Floor, Landco Business Park",
                city: "Legazpi",
                postal_code: "4500",
                country: "PH",
                state: "Albay",
              },
              name: clientName,
              email: userEmailResponse.user.email,
              phone: userEmailResponse.user.contact,
            },
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            payment_method_types: ["gcash", "paymaya", "qrph"], // Add more payment methods as needed
            description: `NearByTask Escrow Deposit`,
            line_items: [
              {
                currency: "PHP",
                amount: paymentInfo.amount * 100, 
                name: `NearByTask Escrow Tokens for ${clientName}`,
                description: `This is a deposit for the task assigned to you`,
                quantity: 1,
              },
            ],
          },
        },
      }),
    };

    // Create PayMongo checkout session
    const paymongoResponse = await fetch(`${process.env.PAYMONGO_URL}/checkout_sessions`, options);
    if (!paymongoResponse.ok) {
      const errorData = await paymongoResponse.json();
      console.error("PayMongo API Error:", errorData);
      if (paymongoResponse.status === 401) {
        throw new Error("Unauthorized: Invalid PayMongo credentials");
      } else if (paymongoResponse.status === 422) {
        throw new Error(`Invalid payment data: ${JSON.stringify(errorData.errors)}`);
      } else {
        throw new Error(`PayMongo API failed: ${paymongoResponse.statusText}`);
      }
    }

    const paymongoData = await paymongoResponse.json() as PayMongoResponse;
    console.log("PayMongo Response:", paymongoData);

    // Assign transaction_id and payment_date *after* successful response
    paymentInfo.transaction_id = paymongoData.data.id;


    console.log("Updated Payment Info:", paymentInfo);

    // Insert into Supabase
    const { error: insertError } = await supabase.from("payment_logs").insert([paymentInfo]);
    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      throw new Error(`Failed to log payment: ${insertError.message}`);
    }



    return {
      paymentUrl: paymongoData.data.attributes.checkout_url,
      transactionId: paymongoData.data.id,
    };
  }

  static async fetchTransactionId(taskTakenId: number) {
    const { data, error } = await supabase
      .from("payment_logs")
      .select("transaction_id")
      .eq("task_taken_id", taskTakenId)
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("No transaction found for this task taken ID");
    return data.transaction_id;
  }

  //To Refund ALL payment to Client in case of account deletion.
  static async cancelTransaction(transactionId: string, cancellationReason: string) {
    // TODO: Utilize Xendit API for refunds (or other payment processor)

    const { error } = await supabase
      .from("payment_logs")
      .update({ status: "cancelled" })
      .eq("transaction_id", transactionId);
    if (error) throw new Error(error.message);

    return { message: "Transaction cancelled or refunded" };
  }

  static async releasePayment(paymentInfo: Payment) {
    if (paymentInfo.amount <= 0) throw new Error("Invalid Amount to be released. Please Try Again.");
    
    const finalAmount = paymentInfo.amount * 0.9;
    paymentInfo.amount = finalAmount
    const { error } = await supabase
          .from("payment_logs")
          .insert([paymentInfo])
    console.log("Errors:", error);
    if (error) throw new Error(error.message);
  }

  static async getPaymentLogsWithUser() {
    const { data, error } = await supabase
      .from('payment_logs')
      .select(`
        transaction_id,
        amount,
        payment_type,
        deposit_date,
        created_at,
        clients (
          user (
            first_name,
            middle_name,
            last_name
          )
        )
      `).order('payment_history_id', { ascending: false });;
    if (error) throw new Error(error.message);
    return data;
  }

  //In Case of Dispute raised by either user/
  static async refundCreditstoClient(task_taken_id: number, task_id: number) {
    const task_amount = await taskModel.getTaskAmount(task_taken_id);
    if(!task_amount) return {error: "Unable to retrieve task payment. Please Try Again."}

    const {error: UpdateClientCreditsError} = await supabase.rpc('increment_client_credits', { addl_credits: task_amount.post_task.proposed_price, id: task_amount.post_task.client_id})

    if(UpdateClientCreditsError) throw new Error(UpdateClientCreditsError.message)
  }

  static async releaseHalfCredits(task_taken_id: number, task_id: number){
    const task_amount = await taskModel.getTaskAmount(task_taken_id)

    if(!task_amount) return {error: "Unable to retrieve task payment. Please Try Again."}

    const amountSplitted = task_amount.post_task.proposed_price * 0.5

    const {error: UpdateClientCreditsError} = await supabase.rpc('increment_client_credits', { addl_credits: amountSplitted, id: task_amount.post_task.client_id})

    if(UpdateClientCreditsError) throw new Error(UpdateClientCreditsError.message)

    const { error: updateTaskerCreditsError } = await supabase
    .rpc('update_tasker_amount', {
      addl_credits: amountSplitted, 
      id: task_amount?.tasker.tasker_id,
    });

    if(updateTaskerCreditsError) throw new Error(updateTaskerCreditsError.message)
  }
}

export default PayMongoPayment;