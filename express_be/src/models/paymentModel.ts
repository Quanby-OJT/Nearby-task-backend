import { supabase } from "../config/configuration";

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
    errors?: any; // For detailed error capture
}

class EscrowPayment {
    static async createPayment(paymentInfo: Payment) {
 
          interface UserEmailResponse {
              clients: { user: { email: string } };
              tasker: { user: { email: string } };
          }
  
          const { data: userEmailResponse, error: emailError } = await supabase
              .from("task_taken")
              .select("clients (user(email)), tasker (user(email))")
              .eq("task_taken_id", paymentInfo.task_taken_id)
              .single() as { data: UserEmailResponse | null, error: any };
          
          console.log("User Email Response:", userEmailResponse);
          if (emailError || !userEmailResponse) throw new Error("Failed to fetch user emails");
  
          const taskerEmail = userEmailResponse.tasker.user.email;
          const clientEmail = userEmailResponse.clients.user.email;
  
          const authString = `${process.env.ESCROW_EMAIL}:${process.env.ESCROW_API}`;
          console.log("Auth String:", authString);
          const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
  
          const escrowPayload = {
              parties: [
                  {
                      role: "buyer",
                      customer: clientEmail, // Often required instead of just 'email'
                      email: clientEmail,
                  },
                  {
                      role: "seller",
                      customer: taskerEmail,
                      email: taskerEmail,
                  },
              ],
              items: [{
                  title: "Task Assignment Deposit",
                  description: "Initial Deposit for Task Assignment",
                  type: "general_merchandise", // Often required
                  quantity: 1,
                  amount: paymentInfo.contract_price,
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
  

          const escrowData = await escrowResponse.json() as EscrowResponse;
          console.log("Escrow Response Status:", escrowResponse.status);
          console.log("Escrow Response Body:", JSON.stringify(escrowData, null, 2));
  
          if (!escrowResponse.ok) {
              console.error("Escrow API Error:", JSON.stringify(escrowData.errors, null, 2));
              if (escrowResponse.status === 401) {
                  return { error: "Unauthorized: Invalid Escrow credentials" };
              } else if (escrowResponse.status === 422) {
                  return {
                      error: "Invalid transaction data",
                      details: escrowData.errors,
                  };
              } else {
                  return {
                      error: `Escrow API failed: ${escrowData.message || escrowResponse.statusText}`,
                  };
              }
          }
  
          const escrowTransactionId = escrowData.id;
          const paymentUrl = escrowData.checkout_url;
          paymentInfo.escrow_transaction_id = escrowTransactionId;

        const { data, error } = await supabase.from("escrow_payment").insert([paymentInfo]);
        if (error) throw new Error(error.message);

        return {data, paymentUrl, escrowTransactionId};
    }

    static async updatePayment(paymentInfo: Payment) {
        const { data, error } = await supabase.from("escrow_payment").upsert([paymentInfo]);
        if (error) throw new Error(error.message);

        return data;
    }
}

export default EscrowPayment;