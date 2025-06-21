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
      .select("*")
      .eq("tasker_id", user_id);
    console.log(taskerData, userDocument, userDocumentError);

    // Don't throw error if documents don't exist, just log it
    if (userDocumentError) {
      console.warn("User Document Warning:", userDocumentError.message);
    }

    return { tasker: taskerData, userDocument: userDocument || null };
  }

  static async getUserDocs(user_id: string) {
    // Log the user_id being passed from the frontend
    console.log("getUserDocs called with user_id:", user_id);
    /**
     * Error in retrieving data, walang foreign id sa user table. To be changed in retrieving from 3 tables at once.
     */
    // Fetch all documents for the user (no .single())
    const {data: userDocData, error: userDocError} = await supabase.from("user_documents").select("user_document_link, document_type").eq("user_id", user_id);
    if (userDocError) {
      console.error("User documents error:", userDocError);
      if (userDocError.code === "PGRST116") return null;
      throw new Error("Error in retrieving documents: " + userDocError.message);
    }

    // Fetch single identification document (assuming one per user)
    const {data: userIdentificationData, error: userIdentificationError} = await supabase.from("user_id").select("id_image").eq("user_id", user_id).single();
    if (userIdentificationError) {
      console.error("User identification error:", userIdentificationError);
      if (userIdentificationError.code === "PGRST116") return null;
      throw new Error("Error in retrieving user Identification Document: " + userIdentificationError.message);
    }

    // Fetch single face identity (assuming one per user)
    const {data: userFaceData, error: userFaceError} = await supabase.from("user_face_identity").select("face_image").eq("user_id", user_id).single();
    if (userFaceError) {
      console.error("User face identity error:", userFaceError);
      if (userFaceError.code === "PGRST116") return null;
      throw new Error("Error in retrieving User Selfie: " + userFaceError.message);
    }

    // Log the returned data
    console.log("getUserDocs returning:", {
      user_documents: userDocData,
      user_id: userIdentificationData,
      user_face_identity: userFaceData
    });

    return {user: {user_documents: userDocData, user_id: userIdentificationData, user_face_identity: userFaceData}};
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