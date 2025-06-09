import { supabase } from "../config/configuration";

class ClientModel {
  static async createNewClient(user_id: number, bio: Text, social_media_links: JSON) {
    const { error } = await supabase.from("user_veridy").insert({
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
      .select("first_name, middle_name, last_name, birthdate, email, contact, gender, status, user_role")
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

  static async updateClient(user_id: number, bio: Text, social_media_links: JSON) {
    const { data, error } = await supabase
      .from("user_verify")
      .update({
        bio: bio,
        social_media_links: social_media_links
      })
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return data;
  }

  static async archiveCLient(clientId: number) {
    const { data, error } = await supabase
      .from("clients")
      .update({ acc_status: "blocked" })
      .eq("id", clientId);
    if (error) throw new Error(error.message);
    return data;
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
