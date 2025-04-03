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
      .single();
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
      .single();
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
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  static async getUserDocs(user_id: string) {
    const { data, error } = await supabase
      .from("client_documents")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  static async showClient(user_id: string) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("preferences, client_address")
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
    const { data: tasker, error: taskerError } = await supabase
      .from("tasker")
      .select(
        "tasker_id, bio, tasker_specialization(specialization), skills, availability, wage_per_hour, social_media_links, address, pay_period"
      ) // Removed profile_picture
      .eq("tasker_id", user_id)
      .maybeSingle();
    console.log(tasker, taskerError);

    if (taskerError) {
      console.error("Tasker Query Error:", taskerError);
      throw new Error("Tasker Error: " + taskerError.message);
    }

    const { data: taskerDocument, error: taskerDocumentError } = await supabase
      .from("tasker_documents")
      .select("tesda_document_link")
      .eq("tasker_id", user_id);
    console.log(tasker, taskerError, taskerDocument, taskerDocumentError);

    if (taskerDocumentError) throw new Error("Tasker Document Error: " + taskerDocumentError.message);

    return { tasker, taskerDocument };
  }
}

export { UserAccount };