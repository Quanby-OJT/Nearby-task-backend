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
    console.log(`Attempting to fetch user with ID: ${user_id}`);
    const { data, error } = await supabase
      .from("user")
      .select(`
        user_id,
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
        added_by
      `)
      .eq("user_id", user_id)
      .single();

    if (error) {
      console.error(`Error fetching user ${user_id}:`, error);
      throw new Error(error.message);
    }
    console.log(`Successfully fetched user ${user_id} data:`, data);
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
    // Get bio and social_media_links from user_verify table only
    const { data: verifyData, error: verifyError } = await supabase
      .from("user_verify")
      .select("bio, social_media_links")
      .eq("user_id", user_id)
      .maybeSingle();

    if (verifyError) {
      console.warn("User Verify Query Warning:", verifyError.message);
    }

    // Return only verification data (no more tasker table data)
    const taskerData = {
      bio: verifyData?.bio || '',
      social_media_links: verifyData?.social_media_links || '{}'
    };

    const { data: userDocument, error: userDocumentError } = await supabase
      .from("user_documents")
      .select("doc_name, user_document_link")
      .eq("tasker_id", user_id);
    console.log(taskerData, userDocument, userDocumentError);

    // Don't throw error if documents don't exist, just log it
    if (userDocumentError) {
      console.warn("User Document Warning:", userDocumentError.message);
    }

    return { tasker: taskerData, userDocument: userDocument || null };
  }

  static async getUserDocs(user_id: string) {
    const { data, error } = await supabase
      .from("user")
      .select(`
        user_role,
        user_documents!user_documents_tasker_id_fkey (doc_name, user_document_link, document_type),
        user_id!user_id_user_id_fkey (id_image),
        user_face_identity!user_face_identity_user_id_fkey (face_image)
      `)
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);

    return data;
  }

  static async updateTaskerDocumentsValid(user_id: string, valid: boolean) {
    // Update user_documents directly using user_id (no need to check tasker table)
    const { error: updateError } = await supabase
      .from("user_documents")
      .update({ valid: valid })
      .eq("tasker_id", user_id);

    if (updateError) {
      console.error("User Documents Update Error:", updateError);
      throw new Error("User Documents Update Error: " + updateError.message);
    }

    console.log(`Updated user_documents for user_id ${user_id}: valid set to ${valid}`);
  }
}

export { AuthorityAccount };