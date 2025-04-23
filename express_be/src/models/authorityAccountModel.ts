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
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  static async showClient(user_id: string) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
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
      .select("*")
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

  static async getUserDocs(user_id: string) {
    // Join user with client_documents directly, and with tasker_documents through tasker
    const { data, error } = await supabase
      .from("user")
      .select(`
        user_role,
        client_documents!client_documents_user_id_fkey (document_url),
        tasker!tasker_user_id_fkey (
          tasker_id,
          tasker_documents!tasker_documents_tasker_id_fkey (tesda_document_link)
        )
      `)
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);

    return data;
  }
}

export { AuthorityAccount };