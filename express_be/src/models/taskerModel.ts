import { error } from "console";
import { supabase } from "../config/configuration";

class TaskerModel {
  static async createTasker( user_id: number, bio: Text, specialization_id: number, skills: string,  availability: boolean, wage_per_hour: number, pay_period: string, group: boolean, social_media_links: JSON, address: JSON, profile_images?: number[]) {
    const { error: NewTaskerError } = await supabase.from("tasker").insert({
      user_id,
      specialization_id,
      skills,
      availability,
      wage_per_hour,
      pay_period,
      group,
      address,
      profile_images
    });
    console.log(error);
    if (NewTaskerError) throw new Error(NewTaskerError.message);

    const { error: UpdateUserBioError } = await supabase.from("user_verify").insert({
      bio,
      social_media_links
    })

    if(UpdateUserBioError) throw new Error(UpdateUserBioError.message)
  }

  static async uploadTaskerFiles(user_id: number, user_document_link?: String[]){
    const { data: existingDocument, error: existingDocumentError } = await supabase.from("user_documents").select("user_document_link").single()

    if(existingDocumentError) throw new Error("Error in uploading documents: " + existingDocumentError.message)
  }

  /**
   * The code is intended for the authenticated user.
   * @returns - {Promise<{id: number, bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}[]>}
   * @throws {Error}
   */
  static async getAuthenticatedTasker(user_id: number) {
    const { data: userInfoData, error: userInfoError } = await supabase
      .from("user")
      .select("first_name, middle_name, last_name, birthdate, email, contact, gender, status, user_role")
      .eq("user_id", user_id)
      .single();

    if (userInfoError) {
      throw new Error("Error retrieving user information: " + userInfoError.message);
    }

    const { data: tasker, error: taskerError } = await supabase
      .from("tasker")
      .select("*, tasker_specialization(specialization)")
      .eq("user_id", user_id)
      .single();

    const { data: userInfo, error: userError } = await supabase
      .from("user_verify")
      .select("*")
      .eq("user_id", user_id)
      .single();

    const { data: userDocument, error: userDocumentError } = await supabase
      .from("user_documents")
      .select("*")
      .eq("tasker_id", tasker?.tasker_id)
      .single();

    const taskerData = tasker ? {
      ...tasker,
      bio: userInfo?.bio,
      social_media_links: userInfo?.social_media_links,
      tasker_document_link: userDocument?.user_document_link
    } : undefined;

    return { user: userInfoData, tasker: taskerData };
  }

  /**
   * Update Tasker Information
   */
  static async update(user_id: number, bio: Text, specialization_id: number, skills: string,  availability: boolean, wage_per_hour: number, pay_period: String, group: boolean, social_media_links: JSON, address: JSON, profile_images?: number[]) {
    const { error: UpdateTaskerError } = await supabase.from("tasker").update({
      specialization_id,
      skills,
      availability,
      wage_per_hour,
      pay_period,
      group,
      address,
      profile_images
    }).eq("user_id", user_id);
    console.log(error);
    if (UpdateTaskerError) throw new Error(UpdateTaskerError.message);

    const { error: UpdateUserBioError } = await supabase.from("user_verify").update({
      bio,
      social_media_links
    }).eq("user_id", user_id);

    if(UpdateUserBioError) throw new Error(UpdateUserBioError.message)
  }
}

export default TaskerModel;
