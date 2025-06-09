import { supabase } from "../config/configuration";

class ClientModel {
  static async createNewClient(clientInfo: {
    user_id: number;
    preferences?: string;
    client_address?: string;
    social_media_links?: object;
    rating?: number;
    amount?: number;
  }) {
    const { data, error } = await supabase.from("clients").insert([{
      user_id: clientInfo.user_id,
      preferences: clientInfo.preferences || '',
      client_address: clientInfo.client_address || '',
      social_media_links: clientInfo.social_media_links || {},
      rating: clientInfo.rating || 0,
      amount: clientInfo.amount || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);
    if (error) throw new Error(error.message);
    return data;
  }

  static async updateClient(clientInfo: {
    user_id: number;
    preferences?: string;
    client_address?: string;
    social_media_links?: object;
    rating?: number;
    amount?: number;
  }) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        preferences: clientInfo.preferences,
        client_address: clientInfo.client_address,
        social_media_links: clientInfo.social_media_links,
        rating: clientInfo.rating,
        amount: clientInfo.amount,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", clientInfo.user_id);
    if (error) throw new Error(error.message);
    return data;
  }

  static async getClientByUserId(user_id: number) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user_id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  static async getAllClients() {
    const { data, error } = await supabase.from("clients").select("*");
    if (error) throw new Error(error.message);
    return data;
  }

  static async archiveClient(clientId: number) {
    const { data, error } = await supabase
      .from("clients")
      .update({ acc_status: "blocked" })
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return data;
  }

  // Submit client verification data
  static async submitClientVerification(verificationData: {
    user_id: number;
    social_media_links?: object;
    preferences?: string;
    client_address?: string;
  }) {
    try {
      // Check if client record exists
      const { data: existingClient, error: checkError } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", verificationData.user_id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(checkError.message);
      }

      const clientData = {
        user_id: verificationData.user_id,
        social_media_links: verificationData.social_media_links || {},
        preferences: verificationData.preferences || '',
        client_address: verificationData.client_address || '',
        updated_at: new Date().toISOString()
      };

      if (existingClient) {
        // Update existing client
        const { data, error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("user_id", verificationData.user_id)
          .select();
        
        if (error) throw new Error(error.message);
        return data;
      } else {
        // Create new client record
        const { data, error } = await supabase
          .from("clients")
          .insert([{
            ...clientData,
            rating: 0,
            amount: 0,
            created_at: new Date().toISOString()
          }])
          .select();
        
        if (error) throw new Error(error.message);
        return data;
      }
    } catch (error: any) {
      throw new Error(`Failed to submit client verification: ${error.message}`);
    }
  }

  // fetch data from user where user has role of tasker and acc_status is "Active"
  static async getActiveTaskers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("users.role", "tasker")
      .eq("users.acc_status", "active");
    if (error) throw new Error(error.message);

    return data;
  }
}

export default ClientModel;
