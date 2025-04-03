import e from "express";
import { supabase, authHeader } from "../config/configuration";

interface Payment {
    payment_history_id?: number;
    task_taken_id?: number;
    escrow_transaction_id?: string;
    status: string;
    contract_price: number;
    payment_date: string;
}

interface EscrowResponse {
    message?: string;
    id: string;
    checkout_url: string;
    error?: any; // For detailed error capture
}

class EscrowPayment {
    static async createPayment(paymentInfo: Payment) {
 
          interface UserEmailResponse {
                clients: { user: { email: string } };
                tasker: { user: { email: string } };
                post_task: { task_title: string };
          }
  
          const { data: userEmailResponse, error: emailError } = await supabase
              .from("task_taken")
              .select("clients (user(email)), tasker (user(email)), post_task (task_title)")
              .eq("task_taken_id", paymentInfo.task_taken_id)
              .single() as { data: UserEmailResponse | null, error: any };
          
          console.log("User Email Response:", userEmailResponse);
          if (emailError || !userEmailResponse) throw new Error("Failed to fetch user emails");
  
          const taskerEmail = userEmailResponse.tasker.user.email;
          const clientEmail = userEmailResponse.clients.user.email;
          const taskTitle = userEmailResponse.post_task.task_title;
  
          const authString = `${process.env.ESCROW_EMAIL}:${process.env.ESCROW_API}`;
          console.log("Auth String:", authString);
          const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
  
          const escrowPayload = {
            parties: [
                {
                    role: "buyer",
                    customer: taskerEmail, 
                    email: taskerEmail,
                },
                {
                    role: "seller",
                    customer: clientEmail,
                    email: clientEmail,
                    initiator: true,
                },
            ],
            items: [{
                title: "Task Assignment Deposit",
                description: `Deposit for ${taskTitle}`,
                type: "milestone", 
                quantity: 1,
                inspection_period: 2592000,
                schedule: [
                    {
                        amount: paymentInfo.contract_price,
                        payer_customer: clientEmail,
                        beneficiary_customer: taskerEmail,
                    },
                ],
            }],
            currency: "usd",
            description: "Initial Deposit for Task Assignment",
            return_url: `${process.env.URL}/escrow/callback`,
        };
  
          console.log("Escrow Payload:", JSON.stringify(escrowPayload, null, 2));
  
          const escrowResponse = await fetch(`${process.env.ESCROW_API_URL}/transaction`, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json",
                  "Authorization": authHeader,
              },
              body: JSON.stringify(escrowPayload),
          });
  

          console.log(escrowResponse)
          const escrowData = await escrowResponse.json() as EscrowResponse;
          console.log("Escrow Response Status:", escrowResponse.status);
          console.log("Escrow Response Body:", JSON.stringify(escrowData, null, 2));
  
          if (!escrowResponse.ok) {
              console.error("Escrow API Error:", JSON.stringify(escrowData.error, null, 2));
              if (escrowResponse.status === 401) {
                  return { error: "Unauthorized: Invalid Escrow credentials" };
              } else if (escrowResponse.status === 422) {
                  return {
                      error: "Invalid transaction data",
                      details: escrowData.error,
                  };
              } else if(escrowResponse.status === 500) {
                  return {
                      error: `Escrow API failed: ${escrowData.message || escrowResponse.statusText}`,
                  };
              }
          }
  
          const escrowTransactionId = escrowData.id;
          const paymentUrl = escrowData.checkout_url;
          paymentInfo.escrow_transaction_id = escrowTransactionId;

        const { data, error } = await supabase.from("escrow_payment_logs").insert([paymentInfo]);
        if (error) throw new Error(error.message);

        return {data, paymentUrl, escrowTransactionId};
    }

    //For payment methods
    static async fetchPaymentMethods(escrowTransactionId: string) {
        const response = await fetch(`${process.env.ESCROW_API_URL}/transaction/${escrowTransactionId}/payment_methods`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
            },
        });

        return response.json();
    }

    static async getPaymentMethods(escrowTransactionId: string) {
        const response = await fetch(`${process.env.ESCROW_API_URL}/transaction/${escrowTransactionId}/payment_methods`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch payment methods: ${response.statusText}`);
        }
        return response.json();
    }

    static async cancelTransaction(escrow_transaction_id: string, cancellationReason: string){
        const response = await fetch(`${process.env.ESCROW_API_URL}/transaction/${escrow_transaction_id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
            },
            body: JSON.stringify({
                action: "cancel",
                cancel_information: {
                    cancellation_reason: cancellationReason
                }
            })
        })

        if (!response.ok) {
            throw new Error(`Failed to cancel transaction: ${response.statusText}`);
        }
        const escrowData = await response.json() as EscrowResponse;

        const {data, error} = await supabase.from("escrow_payment_logs").update({status: "cancelled"}).eq("escrow_transaction_id", escrow_transaction_id)
        if (error) throw new Error(error.message);
        return data;
    }

    static async completeTransaction(escow_transaction_id: string){
        return "Hi"
    }
}

export default EscrowPayment;