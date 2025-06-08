import { supabase } from "../config/configuration";

class TaskerModel {
  static async createTasker(
    tasker: {
      user_id: number;
      bio: Text;
      specialization_id: number;
      skills: string; 
      availability: boolean;
      wage_per_hour: number;
      tesda_documents_id: number;
      social_media_links: JSON;
      address: JSON;
    }) {
    const { data, error } = await supabase.from("tasker").insert([tasker]);
    console.log(data, error);
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * The code is intended for the authenticated user.
   * @returns - {Promise<{id: number, bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}[]>}
   * @throws {Error}
   */
  static async getAuthenticatedTasker(user_id: number) {
    const { data, error } = await supabase
      .from("tasker")
      .select("*, user(*)")
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Update Tasker Information
   */
  static async update(
    tasker: {
      tasker_id: number;
      address: JSON;
      bio: Text;
      skills: string;
      availability: boolean;
      group: boolean,
      wage_per_hour: number;
      social_media_links: JSON;
      profile_images?: JSON;
    },
    withForeignKeys: {
      specialization: string;
      tesda_documents_link: JSON;
    },
    user?: {
      user_id: number;
      first_name: Text;
      middle_name: Text;
      last_name: Text;
      email: Text;
      password: Text;
    }
  ) {
    const { data: specializations, error: specializationError } = await supabase
      .from("tasker_specialization")
      .select("spec_id")
      .eq("specialization", withForeignKeys.specialization)
      .single();
    if (specializationError) throw new Error(specializationError.message);
  
    // if(withForeignKeys.tesda_documents_link === null) {
    // const { error: tesda_error } = await supabase
    //   .from("user_documents")
    //   .insert({ tesda_document_link: withForeignKeys.tesda_documents_link })
    //   .select("id")
    //   .single();
    // if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);
    // }else{
    //   const { error: tesda_error } = await supabase
    //   .from("tasker_documents")
    //   .update({ tesda_document_link: withForeignKeys.tesda_documents_link })
    //   .eq("tasker_id", tasker.tasker_id)
    //   if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);
    // }

    // const { data: userData, error: userError } = await supabase
    //   .from("user")
    //   .update(user)
    //   .eq("user_id", user.user_id);
    // if (userError) throw new Error(userError.message);

    if(withForeignKeys.tesda_documents_link !== null){
      const {error: documentError} = await supabase.from("tasker_documents").update({
        document_type: "TESDA Document", //Temporary. Will Update if demand increases.
        user_document_link: withForeignKeys.tesda_documents_link,
        valid: false
      }).eq("tasker_id", tasker.tasker_id).select("id").single()

      if(documentError) throw new Error(documentError.message)
    }
  
    const { error: taskerError } = await supabase
      .from("tasker")
      .update({
        address: tasker.address,
        bio: tasker.bio,
        skills: tasker.skills,
        availability: tasker.availability,
        wage_per_hour: tasker.wage_per_hour,
        social_media_links: tasker.social_media_links,
        specialization_id: specializations.spec_id,
        profile_images: tasker.profile_images
      })
      .eq("tasker_id", tasker.tasker_id);
    console.log(taskerError);
    if (taskerError) throw new Error(taskerError.message + "\n\n" + taskerError.stack);
  }
}

export default TaskerModel;
