import {Request, Response} from "express";
import { authHeader, supabase, nextpay_api_key, nextpay_secret_key } from "../config/configuration";
import taskModel from "./taskModel";
import Crypto from "crypto";
import { Client } from "socket.io/dist/client";

interface Payment {
  payment_history_id?: number;
  user_id?: number;
  transaction_id?: string;
  amount: number;
  deposit_date?: string;
  withdraw_date?: string;
  payment_type: string;
  task_taken_id?: number;
  payment_method?: string;
  status?: string;
  account_no?: string;
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
class QTaskPayment {
  static async checkoutPayment(paymentInfo: Payment) {
    
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
    interface UserEmailResponse {
      first_name: string, 
      middle_name: string, 
      last_name: string 
      email: string,
      contact: string
    }

    // Fetch user and task data from Supabase
    const { data: userEmailResponse, error: emailError } = await supabase
      .from("user")
      .select("first_name, middle_name, last_name, email, contact)")
      .eq("user_id", paymentInfo.user_id)
      .single() as { data: UserEmailResponse | null; error: any };

    if (emailError || !userEmailResponse) throw new Error(emailError.message || "Failed to fetch user email data");
    console.log("User Email Response:", userEmailResponse);

    const clientName = `${userEmailResponse.first_name} ${userEmailResponse.middle_name} ${userEmailResponse.last_name}`;
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
        description: `Amount to be Deposited:\n` +
          `• Amount: PHP ${paymentInfo.amount}\n` +
          `• Client: ${clientName}\n` +
          `• Purpose: Deposit Amount to QTask\n` +
          `• Description: Your Deposited Amount will be only used to:\n` +
          `  - Create and post new tasks\n` +
          `  - Set task budgets\n` +
          `  - Secure task payments`,
        statement_descriptor: 'QTask Escrow Deposit'
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
    const { error: insertError } = await supabase.from("payment_logs").insert({
      user_id: paymentInfo.user_id,
      payment_type: paymentInfo.payment_type,
      transaction_id: paymongoIntentData.data.id,
      amount: paymentInfo.amount,
      transaction_date: paymentInfo.deposit_date,
      payment_method: paymentInfo.payment_method,
      status: paymongoIntentData.data.attributes.status,
    });

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
              phone: userEmailResponse.contact,
              email: userEmailResponse.email
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
            return_url: `${process.env.PAYMONGO_PAYMENT_URL}/payment/${paymentInfo.amount}/${paymentInfo.transaction_id}`
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

  //Only for Admin and Moderator
  static async getPaymentDetails(transactionId: string, payment_type: string) {
    if (!transactionId) {
      throw new Error("Transaction ID is required to fetch payment details");
    }
    let options = {}
    if (!payment_type) {
      // Fetch payment type from Supabase if not provided
      const { data, error } = await supabase
        .from("payment_logs")
        .select("payment_type")
        .eq("transaction_id", transactionId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("No payment found for this transaction ID");

      payment_type = data.payment_type;
    }

    if(payment_type === "Client Deposit") {
        // Fetch payment details from PayMongo
        options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: authHeader,
          }
        }

        const paymentData = await fetch(`${process.env.PAYMONGO_URL}/payment_intents/${transactionId}`, options);
        if (!paymentData.ok) {
          const errorData = await paymentData.json();
          this.handlePayMongoErrors(errorData);
          throw new Error(`PayMongo API failed: ${errorData.message}`);
        }

        const paymentDetails = await paymentData.json() as AttachedPaymentResponse;
        console.log("Payment Details:", paymentDetails);
        return paymentDetails.data;
    }else if(payment_type === "QTask Withdrawal") {
        //Implement NextPay API for withdrawal details
        const fetch = require('node-fetch');
        options = {method: 'GET', headers: {'client-id': nextpay_api_key, Accept: 'application/json'}};

        try {
          const response = await fetch(`https://api-sandbox.nextpay.world/v2/disbursements/${transactionId}`, options);
          const data = await response.json();
          return data;
        } catch (error) {
          console.error(error);
          this.handlePayMongoErrors(error);
        }
    }
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
    // TODO: Utilize NextPay API for refunds (or other payment processor)

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
      first_name: string, 
      middle_name: string, 
      last_name: string 
      email: string,
      contact: string
    }

    // Fetch user and task data from Supabase
    const { data: userEmailResponse, error: emailError } = await supabase
      .from("user")
      .select("first_name, middle_name, last_name, email, contact")
      .eq("user_id", paymentInfo.user_id)
      .single() as { data: UserEmailResponse | null; error: any };

    if (emailError || !userEmailResponse) throw new Error(emailError.message || "Failed to fetch user email data");
    console.log("User Email Response:", userEmailResponse);

    const taskerName = `${userEmailResponse.first_name} ${userEmailResponse.middle_name} ${userEmailResponse.last_name}`;
  
    const payment_method = paymentInfo.payment_method?.toLowerCase()

    /**
     * Implement NextPay API for release of Payment
     */

    //Getting a specific bank based on the bank id
    let bankId = 0;
    if(payment_method == "gcash") bankId = 40
    else if(payment_method == "paymaya") bankId = 57

    /**
     * Creating a Disbursement
     */
    const nextPayOptions = {
      name: `Escrow Withdrawal - ${paymentInfo.withdraw_date}`,
      private_notes: "QTask Escrow Withdrawal", 
      require_authorization: false,
      recipients: [
        {
          amount: paymentInfo.amount,
          currency: "PHP",
          name: "string",
          first_name: userEmailResponse.first_name,
          last_name: userEmailResponse.last_name,
          email: userEmailResponse.email,
          phone_number: userEmailResponse.contact,
          private_notes: "QTask Escrow Withdrawal",
          recipient_notes: `This is a withdrawal amounting to PHP ${paymentInfo.amount} to be released to ${taskerName}.`,
          destination: {
          method: "instapay",  
          bank: bankId,            
          account_name: taskerName,
          account_number: paymentInfo.account_no
          }
        }
      ],
      nonce: Date.now() // Current UNIX epoch timestamp in milliseconds
    }

    const rawPayload = JSON.stringify(nextPayOptions)
    const signature = Crypto.createHmac("sha256", process.env.NEXTPAY_SECRET_KEY!).update(rawPayload).digest("hex")

    // console.log(nextPayOptions)
    // console.log("NextPay URL:", process.env.NEXTPAY_URL);
    // console.log("Client ID:", process.env.NEXTPAY_API_KEY?.slice(0, 10)); // should start with `np_test_`
    // console.log("Secret Key:", process.env.NEXTPAY_SECRET_KEY?.slice(0, 10));


    // Verify signature matches payload
    const computedSignature = Crypto.createHmac("sha256", process.env.NEXTPAY_SECRET_KEY!)
      .update(rawPayload)
      .digest("hex");

    // console.log(signature === computedSignature)

    // if (signature !== computedSignature) {
    //   throw new Error("Invalid signature - payload may have been tampered with");
    // }

    const nextPayData = await fetch(`${process.env.NEXTPAY_URL}/disbursements`, {
      method: "POST",
      headers: {
        "client-id": process.env.NEXTPAY_API_KEY!,
        signature: signature,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: rawPayload
    });

    if (!nextPayData.ok) {
      const errorData = await nextPayData.json();
      console.error("NextPay API Error:", errorData);
      throw new Error(`NextPay API failed: ${errorData.message.message}`);
    }

    const nextPayResponse = await nextPayData.json();
    console.log("NextPay Response:", nextPayResponse);

    const { error } = await supabase
          .from("payment_logs")
          .insert({
            user_id: paymentInfo.user_id,
            payment_type: paymentInfo.payment_type,
            transaction_id: nextPayResponse.id,
            amount: paymentInfo.amount,
            transaction_date: paymentInfo.withdraw_date,
            payment_method: paymentInfo.payment_method,
            status: nextPayResponse.status,
            reference_id: nextPayResponse.reference_id
          })

          
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
        transaction_date,
        created_at,
        user (
          first_name,
          middle_name,
          last_name
        )
      `).order('payment_history_id', { ascending: false });;
    if (error) throw new Error(error.message);
    return data;
  }

  //Checker is the tasker/client has sufficient Amount before galawin ang kaniyang amount from the database.
  static async checkBalance(user_id: number){
    let amount: number = 0
    let tableRole: string = ""
    const {data: roleData, error: roleError} = await supabase.from("user").select("user_role").eq("user_id", user_id).single()

    if(roleError) throw new Error(roleError.message)
    
      switch (roleData.user_role) {
        case "Tasker":
          tableRole = "tasker";
          break;
        case "Client":
          tableRole = "clients";
          break;
        default:
          return {error: "Invalid user role"};
      }

      const {data, error} = await supabase
      .from(tableRole)
      .select("amount")
      .eq("user_id", user_id)
      .single();

      console.log("Data:", data, "Error:", error);

    if (error) throw new Error(error.message);
    if (!data) return {error: "User not found or no amount available"};
    amount = data.amount;

    return {amount, user_role: roleData.user_role};
  }

  //In Case of Dispute raised by either user/
  static async refundCreditstoClient(task_id: number, task_taken_id?: number) {
    let task_amount = await taskModel.getTaskAmount(task_taken_id ?? 0);

    console.log("Task Amount:", task_amount);
    if(!task_amount) return {error: "Unable to retrieve task payment. Please Try Again."}
    let clientAmount: number = 0
    let taskerAmount: number = 0

    clientAmount = task_amount.post_task.proposed_price * 0.7
    taskerAmount = task_amount.post_task.proposed_price * 0.3

    console.log("Client Amount:", clientAmount, "Tasker Amount:", taskerAmount);

    const {error: updateClientCreditsError} = await supabase.rpc('increment_client_credits', { addl_credits: clientAmount, id: task_amount.post_task.client_id})
    const { error: updateTaskerCreditsError } = await supabase.rpc('increment_tasker_amount', { addl_credits: taskerAmount, id: task_amount?.tasker.tasker_id });

    if(updateClientCreditsError || updateTaskerCreditsError) throw new Error(updateClientCreditsError?.message ?? updateTaskerCreditsError?.message)
  }

  //If client decides to delete a task that is available, the payment will be refunded to the client.
  static async refundAvailableTaskAmountToClient(task_id: number) {
    const {data: amount, error: amountError} = await supabase.from("post_task").select("proposed_price, client_id").eq("task_id", task_id).single();
    if(amountError) throw new Error(amountError.message);
    const {error: updateClientCreditsError} = await supabase.rpc('increment_client_credits', { addl_credits: amount.proposed_price, id: amount.client_id})

    if(updateClientCreditsError) throw new Error(updateClientCreditsError.message)
  }

  //If the Moderator hasn't made a decision after 14 days or more, the payment will be paid half to both tasker and client.
  static async releaseHalfCredits(task_taken_id: number){
    const task_amount = await taskModel.getTaskAmount(task_taken_id)

    if(!task_amount) return {error: "Unable to retrieve task payment. Please Try Again."}

    const amountSplitted = task_amount.post_task.proposed_price * 0.5

    const {error: UpdateClientCreditsError} = await supabase.rpc('increment_client_credits', { addl_credits: amountSplitted, id: task_amount.post_task.client_id})

    if(UpdateClientCreditsError) throw new Error(UpdateClientCreditsError.message)

    const { error: updateTaskerCreditsError } = await supabase
    .rpc('increment_tasker_amount', {
      addl_credits: amountSplitted, 
      id: task_amount?.tasker.tasker_id,
    });

    if(updateTaskerCreditsError) throw new Error(updateTaskerCreditsError.message)
  }

  static async deductAmountfromUser(role: string, amount: number, user_id: number) {
    // const { error: deductionError } = await supabase.rpc('decrement_user_credits_by_role', {
    //   subtract_credits: amount,
    //   inp_user_id: user_id,
    //   user_role: role
    // });
    if(role == "Tasker") {
      const {error} = await supabase.rpc('decrement_tasker_credits', {deduct_credits: amount, input_user_id: user_id});

      if(error) throw new Error(error.message);
    }else if(role == "Client") {
      const {error} = await supabase.rpc('deduct_client_credits', {deduct_credits: amount, _client_id: user_id});

      if(error) throw new Error(error.message);
    }
  }

  // Updated method to handle task budget change
  static async updateAmount(updatedAmount: number, user_id: number, task_id: string) {
    // Fetch previous price from the specific task
    const { data, error: checkError } = await supabase
      .from('post_task')
      .select('proposed_price')
      .eq('task_id', task_id)
      .single();

    if (checkError) throw new Error(checkError.message);
    if (!data) throw new Error("Task not found");

    const previousPrice = Number(data.proposed_price);
    const difference = updatedAmount - previousPrice;

    if (difference > 0) {
      // Deduct additional credits if budget increased
      const { error: deductError } = await supabase.rpc('deduct_client_credits', {
        deduct_credits: difference,
        _client_id: user_id,
      });
      if (deductError) throw new Error(`Deduction failed: ${deductError.message}`);
    } else if (difference < 0) {
      // Refund if budget decreased
      const { error: refundError } = await supabase.rpc('increment_client_credits', {
        addl_credits: Math.abs(difference),
        id: user_id,
      });
      if (refundError) throw new Error(`Refund failed: ${refundError.message}`);
    }

    return { success: true, previousPrice, updatedPrice: updatedAmount };
  }
}

export default QTaskPayment;