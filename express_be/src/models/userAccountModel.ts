import { supabase } from "../config/configuration";

class UserAccount {
  static async create(userData: {
    first_name: string;
    middle_name: string;
    last_name: string;
    address: string;
    birthdate: Date;
    email: string;
    image_link?: string;
    hashed_password: string;
    acc_status: string;
    user_role: string;
    verification_token: string;
  }) {
    const { data, error } = await supabase.from("user").insert([userData]);
    console.log(data, error);

    if (error) throw new Error(error.message);
    return data;
  }

  static async getUser(email: string) {
    console.log(email);
    const { data, error } = await supabase
      .from("user")
      .select("verification_token")
      .eq("email", email)
      .maybeSingle();
    console.log(data, error);

    if (error) throw new Error(error.message);
    return data;
  }

  static async resetEmailToken(email: string) {
    const { data, error } = await supabase
      .from("user")
      .update({
        verification_token: null,
        emailVerified: true,
      })
      .eq("email", email)
      .select("user_id")
      .maybeSingle();
    console.log(data, error);

    if (error) throw new Error(error.message);
    return data;
  }

  static async uploadImageLink(user_id: string, image_link: string) {
    const { data, error } = await supabase
      .from("user")
      .update({ image_link: image_link })
      .eq("user_id", user_id);

    if (error) throw new Error("User Error: " + error.message);

    return data;
  }

  static async showUser(user_id: string) {
    const { data, error } = await supabase
      .from("user")
      .select(
        "first_name, middle_name, last_name, image_link, email, birthdate, user_role, gender, contact, acc_status"
      )
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    
    if (!data) throw new Error("User not found");

    return data;
  }

  static async getUserDocs(user_id: string) {

    const {data:userexists, error: userError} = await supabase
    .from("user")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();

    if (userError) throw new Error(userError.message);

    if (!userexists) {
      throw new Error("User not found");
    }

    if (userexists.user_role == "Client") {
      const { data, error } = await supabase
      .from("client_documents")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return data;
    } else if (userexists.user_role == "Tasker") {
        const { data, error } = await supabase
        .from("user_documents")
        .select("*")
        .eq("tasker_id", user_id)
        .maybeSingle();

        if (error) throw new Error(error.message);

        return data;
    }
  }

  static async showClient(user_id: string) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("client_id, preferences, client_address")
      .eq("user_id", user_id)
      .maybeSingle();
    console.log(client, clientError);

    if (clientError) {
      console.error("Client Query Error:", clientError);
      throw new Error("Clientele Error: " + clientError.message);
    }

    return client;
  }

  static async showTasker(user_id: string) {
    // Get verification data from user_verify table only
    const { data: tasker, error: taskerError } = await supabase
      .from("user_verify")
      .select(
        "bio, social_media_links"
      )
      .eq("user_id", user_id)
      .maybeSingle();
    console.log(tasker, taskerError);

    if (taskerError) {
      console.error("User Verify Query Error:", taskerError);
      throw new Error("User Verify Error: " + taskerError.message);
    }

    // Provide default values if no verification data exists
    const taskerData = tasker || {
      bio: '',
      social_media_links: '{}'
    };

    const { data: taskerDocument, error: taskerDocumentError } = await supabase
      .from("user_documents")
      .select("user_document_link")
      .eq("tasker_id", user_id)
      .maybeSingle();
    console.log(taskerData, taskerError, taskerDocument, taskerDocumentError);

    // Don't throw error if documents don't exist, just log it
    if (taskerDocumentError) {
      console.warn("Tasker Document Warning:", taskerDocumentError.message);
    }

    return { tasker: taskerData, taskerDocument: taskerDocument || null };
  }
}

export { UserAccount };