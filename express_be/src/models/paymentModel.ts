import {Request, Response} from "express";
import { supabase } from "../config/configuration";
import taskModel from "./taskModel";
import { send } from "process";
import auth from "../controllers/authAngularController";

interface Payment {
  payment_history_id?: number;
  client_id?: number;
  account_no?: string;
  tasker_id?: number;
  transaction_id?: string;
  amount: number;
  deposit_date?: string;
  withdraw_date?: string;
  payment_type: string;
  task_taken_id?: number;
  payment_method?: string;
  status?: string;
}

// Updated to match PayMongo's checkout_sessions response structure
interface PayMongoIntentResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      amount: number,
      capture_type: string;
      currency: string;
      checkout_url: string;
      client_key: string;
      description: string;
      livemode: boolean;
      original_amount: number;
      statement_descriptor: string;
      last_payment_error: null | object;
      payment_method_allowed: string[];
      payments: Array<object>;
      next_action: null | object;
      status: string; 
      send_email_receipt: boolean;
      metadata: object | null;
      setup_future_usage: null | string;
      created_at: number;
      updated_at: number;
    };
  };
  errors?: Array<{ detail: string }>; // For error cases
}

interface PaymentMethodResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      billing: {
        name: string;
        phone: string;
        email: string;
      };
      type: string;
      created_at: string;
      updated_at: string;
      status: string;
      brand: string;
      last4: string;
      exp_month: number;
      exp_year: number;
    };
  };
  errors?: Array<{ detail: string }>; // For error cases
}

interface AttachedPaymentResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      amount: number;
      capture_type: string;
      client_key: string;
      currency: string;
      description: string;
      livemode: boolean;
      original_amount: number;
      statement_descriptor: string;
      last_payment_error: null | object;
      payment_method_allowed: string[];
      payments: Array<object>;
      next_action: {
        type: string;
        redirect: {
          url: string;
          return_url: string;
        }
      }
      payment_method_options: null | object;
      metadata: object | null;
      setup_future_usage: null | string;
      created_at: number;
      updated_at: number;
    };
  };
  errors?: Array<{ detail: string }>; // For error cases
}

//TODO: Implement XENDIT API response structure
interface XenditResponse {
  error_message?: string; // For error cases
}

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
    const authString = `${process.env.PAYMONGO_SECRET_KEY?.trim()}:`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    /**
     * Creating PaymewntIntent
     */
    
    const paymentIntentOptions = {
      method: 'POST',
      headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: authHeader
      },
      body: JSON.stringify({
      data: {
        attributes: {
        amount: paymentInfo.amount * 100,
        payment_method_allowed: ['paymaya', 'gcash'],
        payment_method_options: {card: {request_three_d_secure: 'any'}},
        currency: 'PHP',
        capture_type: 'automatic',
        description: `IMONALICK Credits Purchase:\n` +
          `• Amount: PHP ${paymentInfo.amount}\n` +
          `• Client: ${clientName}\n` +
          `• Purpose: Credits for Task Creation\n` +
          `• Usage: These credits will be used to:\n` +
          `  - Create and post new tasks\n` +
          `  - Set task budgets\n` +
          `  - Secure task payments`,
        statement_descriptor: 'IMONALICK Task Credits'
        }
      }
      })
    };

    const intentData = await fetch(`${process.env.PAYMONGO_URL}/payment_intents`, paymentIntentOptions);
    if (!intentData.ok) {
      const errorData = await intentData.json();
      this.handlePayMongoErrors(errorData);
      throw new Error(`PayMongo API failed: ${errorData.message}`);
    }

    const paymongoIntentData = await intentData.json() as PayMongoIntentResponse;
    console.log("PayMongo Response:", paymongoIntentData);

    // Assign transaction_id and payment_date *after* successful response
    paymentInfo.transaction_id = paymongoIntentData.data.id;

    // Insert into Supabase
    const { error: insertError } = await supabase.from("payment_logs").insert([paymentInfo]);
    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      throw new Error(`Failed to log payment: ${insertError.message}`);
    }

    /**
     * Creating Payment Methods from the client-side
     */
    const payment_method = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: authHeader
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: clientName,
              phone: userEmailResponse.user.contact,
              email: userEmailResponse.user.email
            },
            type: paymentInfo.payment_method,
          }
        }
      })
    };
    
    const paymentData = await fetch(`${process.env.PAYMONGO_URL}/payment_methods`, payment_method);
    if (!paymentData.ok) {
      const errorData = await paymentData.json();
      this.handlePayMongoErrors(errorData);
      throw new Error(`PayMongo API failed: ${errorData.message}`);
    }

    const paymentMethodData = await paymentData.json() as PaymentMethodResponse;
    console.log("Payment Method Response:", paymentMethodData);

    /**
     * Attaching Payment Intent to Payment Method
     */
    const payMongoAttachOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: authHeader
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: paymentMethodData.data.id,
            client_key: `${paymongoIntentData.data.attributes.client_key}_${paymongoIntentData.data.attributes.client_key}`,
            return_url: 'https://imonalick.com/payment/success'
          }
        }
      })
    };

    const attachData = await fetch(`${process.env.PAYMONGO_URL}/payment_intents/${paymongoIntentData.data.id}/attach`, payMongoAttachOptions);
    if (!attachData.ok) {
      const errorData = await attachData.json();
      console.error("Attach Payment Error:", errorData);
      this.handlePayMongoErrors(errorData);
    }

    const paymentAttachedData = await attachData.json() as AttachedPaymentResponse;
    console.log("PayMongo Response:", paymentAttachedData);

    return {
      checkout_url: paymentAttachedData.data.attributes.next_action.redirect.url,
      client_key: paymentAttachedData.data.attributes.client_key,
      amount: paymentInfo.amount
    };
  }

  private static handlePayMongoErrors(error: any) {
    if (error.status === 401) {
      throw new Error("Unauthorized: Invalid PayMongo credentials");
    } else if (error.status === 422) {
      throw new Error(`Invalid payment data: ${JSON.stringify(error.errors)}`);
    } else {
      throw new Error(`PayMongo API failed: ${error.errors.detail}`);
    }
  }

  static async verifyPaymentIntent(req: Request, res: Response): Promise<void> {
    try {
      const { transaction_id } = req.body;
  
      const authHeader = `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`;
  
      const response = await fetch(`${process.env.PAYMONGO_URL}/payment_intents/${transaction_id}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: 'Basic ' + authHeader
        }
      });
  
      const paymentIntent = await response.json();
  
      const status = paymentIntent.data.attributes.status;
  
      console.log("Verified Status:", status);
  
      // Optional: Update Supabase record status based on this
      if (status === "succeeded") {
        // Update credits or payment_logs here
        await supabase.from("payment_logs")
          .update({ status: "succeeded", confirmed_date: new Date().toISOString() })
          .eq("transaction_id", transaction_id);
  
        res.status(200).json({ success: true, status });
      } else {
        res.status(200).json({ success: false, status });
      }
    } catch (err) {
      console.error("Error verifying payment intent:", err);
      res.status(500).json({ error: "Verification failed" });
    }
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
    
    const finalAmount = paymentInfo.amount * 0.9;
    paymentInfo.amount = finalAmount

    const authString = `${process.env.XENDIT_API_KEY?.trim()}:`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    //TODO: Implement Xendit Cash Disbursement
    // const releaseEscrowPaymentOptions = {
    //   channel_code: 'PH_GCASH',
    //   channel_properties: {
    //     account_number: paymentInfo.account_no,
    //     account_holder_name: clientName
    //   },
    //   amount: 1000,
    //   description: "Release of Escrow Payment to Tasker with Tasker ID of: ",
    //   currency: 'PHP',
    //   receipt_notification: {
    //     email_to: [
    //       userEmailResponse.user.email,
    //       userEmailResponse.user.email
    //     ],
    //     email_cc: [
    //       userEmailResponse.user.email,
    //       userEmailResponse.user.email
    //     ],
    //     email_bcc: [
    //       userEmailResponse.user.email,
    //       userEmailResponse.user.email
    //     ]
    //   },
    //   metadata: {
    //      disb: 24
    //   }
    // };

    // const attachData = await fetch(`${process.env.XENDIT_URL}/`, releaseEscrowPaymentOptions);
    // if (!attachData.ok) {
    //   const errorData = await attachData.json();
    //   console.error("Attach Payment Error:", errorData);
    //   this.handlePayMongoErrors(errorData);
    // }

    // const paymentAttachedData = await attachData.json() as AttachedPaymentResponse;
    // console.log("PayMongo Response:", paymentAttachedData);

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