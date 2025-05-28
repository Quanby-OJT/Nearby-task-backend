import { supabase } from "../config/configuration";

class AuthorityAccount {
  static async create(userData: {
    first_name: string;
    middle_name: string;
    last_name: string;
    birthdate: string;
    email: string;
    user_role: string;
    contact: string;
    gender: string;
    hashed_password: string | null;
    acc_status: string;
    image_link?: string | null;
    emailVerified: boolean;
    verification_token: string | null;
  }) {
    const { data, error } = await supabase.from("user").insert([userData]).select().single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async update(userId: number, updateData: {
    first_name: string;
    middle_name: string;
    last_name: string;
    birthdate: string;
    email: string;
    user_role: string;
    contact: string;
    gender: string;
    acc_status: string;
    image_link?: string | null;
    verified: boolean;
  }) {
    const { data, error } = await supabase
      .from("user")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async showUser(user_id: string) {
    const { data, error } = await supabase
      .from("user")
      .select(`
        first_name, 
        middle_name, 
        last_name, 
        image_link, 
        email, 
        birthdate, 
        user_role, 
        gender, 
        contact, 
        acc_status,
        action_by,
        action_taken_by!action_taken_by_user_id_fkey (
          action_reason,
          created_at,
          user:user_id (
            first_name,
            middle_name,
            last_name
          )
        )
      `)
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
      )
      .eq("tasker_id", user_id)
      .maybeSingle();
    console.log(tasker, taskerError);

    if (taskerError) {
      console.error("Tasker Query Error:", taskerError);
      throw new Error("Tasker Error: " + taskerError.message);
    }

    const { data: userDocument, error: userDocumentError } = await supabase
      .from("user_documents")
      .select("doc_name, user_document_link")
      .eq("tasker_id", user_id);
    console.log(tasker, taskerError, userDocument, userDocumentError);

    if (userDocumentError) throw new Error("User Document Error: " + userDocumentError.message);

    return { tasker, userDocument };
  }

  static async getUserDocs(user_id: string) {
    const { data, error } = await supabase
      .from("user")
      .select(`
        user_role,
        client_documents!client_documents_user_id_fkey (document_url),
        user_documents!user_documents_tasker_id_fkey (doc_name, user_document_link),
        user_id!user_id_user_id_fkey (id_image),
        user_face_identity!user_face_identity_user_id_fkey (face_image)  -- Added join to fetch face_image from user_face_identity table
      `)
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  static async updateTaskerDocumentsValid(user_id: string, valid: boolean) {
    const { data: tasker, error: taskerError } = await supabase
      .from("tasker")
      .select("tasker_id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (taskerError) {
      console.error("Tasker Query Error:", taskerError);
      throw new Error("Tasker Query Error: " + taskerError.message);
    }

    if (!tasker) {
      console.log(`No tasker found for user_id: ${user_id}`);
      return;
    }

    const taskerId = user_id; // Use user_id directly as tasker_id in user_documents

    const { error: updateError } = await supabase
      .from("user_documents")
      .update({ valid: valid })
      .eq("tasker_id", taskerId);

    if (updateError) {
      console.error("User Documents Update Error:", updateError);
      throw new Error("User Documents Update Error: " + updateError.message);
    }

    console.log(`Updated user_documents for tasker_id ${taskerId}: valid set to ${valid}`);
  }
}

export { AuthorityAccount };