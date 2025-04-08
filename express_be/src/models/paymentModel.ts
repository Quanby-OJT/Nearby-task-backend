import e from "express";
import { supabase } from "../config/configuration";

interface Payment {
  payment_history_id?: number;
  task_taken_id?: number;
  transaction_id?: string;
  status: string;
  contract_price: number;
  payment_date: string;
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

class PayMongoPayment {
  static async checkoutPayment(paymentInfo: Payment) {
    interface UserEmailResponse {
      clients: { user: { email: string } };
      tasker: { user: { email: string } };
      post_task: { task_title: string };
    }

    // Fetch user and task data from Supabase
    const { data: userEmailResponse, error: emailError } = await supabase
      .from("task_taken")
      .select("clients (user(email)), tasker (user(email)), post_task (task_title)")
      .eq("task_taken_id", paymentInfo.task_taken_id)
      .single() as { data: UserEmailResponse | null; error: any };

    if (emailError || !userEmailResponse) throw new Error("Failed to fetch user emails");
    console.log("User Email Response:", userEmailResponse);

    const taskTitle = userEmailResponse.post_task.task_title;

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
              name: "NearByTask",
              email: "nearbytask@gmail.com",
              phone: "09221776654",
            },
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `NearByTask Initial Deposit`,
            line_items: [
              {
                currency: "PHP",
                amount: paymentInfo.contract_price * 100, // Convert to centavos
                name: `Escrow Initial Deposit for: ${taskTitle}`,
                quantity: 1,
              },
            ],
            payment_method_types: ["qrph"], // QRPH only for now
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
    paymentInfo.payment_date = new Date().toISOString();

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

  static async fetchPaymentMethods(transactionId: string) {
    const response = await fetch(`${process.env.PAYMONGO_API_URL}/checkout_sessions/${transactionId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`,
      },
    });
    if (!response.ok) {
      console.error("Error fetching checkout session:", response.statusText);
      throw new Error(`Failed to fetch payment methods: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Checkout Session Response:", data);
    return data.data.attributes.payment_method_types; // Returns supported payment methods
  }

  static async cancelTransaction(transactionId: string, cancellationReason: string) {
    // PayMongo doesn’t support direct cancellation of checkout sessions; refund if paid
    const response = await fetch(`${process.env.PAYMONGO_API_URL}/checkout_sessions/${transactionId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`,
      },
    });
    const sessionData = await response.json();

    if (sessionData.data.attributes.status === "paid") {
      const refundPayload = {
        data: {
          attributes: {
            amount: sessionData.data.attributes.line_items[0].amount,
            reason: cancellationReason,
            payment_id: sessionData.data.attributes.payments[0]?.id, // Requires payment to be completed
          },
        },
      };
      const refundResponse = await fetch(`${process.env.PAYMONGO_API_URL}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${process.env.PAYMONGO_SECRET_KEY}:`).toString("base64")}`,
        },
        body: JSON.stringify(refundPayload),
      });
      if (!refundResponse.ok) throw new Error(`Refund failed: ${refundResponse.statusText}`);
    }

    const { error } = await supabase
      .from("payment_logs")
      .update({ status: "cancelled" })
      .eq("transaction_id", transactionId);
    if (error) throw new Error(error.message);

    return { message: "Transaction cancelled or refunded" };
  }

  static async completeTransaction(transactionId: string) {
    // Placeholder: Mark as completed in Supabase once payment is confirmed
    const { error } = await supabase
      .from("payment_logs")
      .update({ status: "completed" })
      .eq("transaction_id", transactionId);
    if (error) throw new Error(error.message);
    return { message: "Transaction marked as completed" };
  }
}

export default PayMongoPayment;