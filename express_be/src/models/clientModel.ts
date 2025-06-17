import { supabase } from "../config/configuration";

class ClientModel {
  /**
   * NOTE FROM THE PREVIOUS DEVELOPER: the "bio" and "spcial_media_links" attribute will be relocated to "user" table.
   */
  static async createNewClient(user_id: number, bio: Text, social_media_links: JSON) {
    const { error } = await supabase.from("user_verify").insert({
      bio: bio,
      social_media_links: social_media_links
    });
    if (error) throw new Error(error.message);
  }

  static async getAllClients() {
    const { data, error } = await supabase.from("clients").select("*");
    if (error) throw new Error(error.message);

    return data;
  }

  static async getClientInfo(user_id: number) {
    // Get user information (required)
    const { data: userInfoData, error: userInfoError } = await supabase
      .from("user")
      .select("first_name, middle_name, last_name, birthdate, email, contact, gender, acc_status, user_role, verified, image_link ")
      .eq("user_id", user_id)
      .single();

    if (userInfoError && userInfoError.code !== "PGRST116") {
      throw new Error("Error retrieving user information: " + userInfoError.message);
    }

    // Get client profile (optional)
    const { data: userProfileData, error: userProfileError } = await supabase
      .from("user_verify")
      .select("*")
      .eq("user_id", user_id)
      .single();

    // Return both user info and client profile (if exists)
    return {
      user: userInfoData,
      client: userProfileError?.code === "PGRST116" ? null : userProfileData
    };
  }

  static async updateClient(user_id: number, bio: Text, social_media_links: JSON, image_link?: string) {
    const { error } = await supabase
      .from("user_verify")
      .update({
        bio: bio,
        social_media_links: social_media_links
      })
      .eq("user_id", user_id);

      if(image_link) {
        const {error: updateUserProfileError} = await supabase.from("user").update({image_link}).eq("user_id", user_id)
        if(updateUserProfileError) throw new Error("Error while updating your profile Image: " + updateUserProfileError.message)
      }
    
    if (error) throw new Error(error.message);
  }

  static async archiveCLient(clientId: number) {
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
