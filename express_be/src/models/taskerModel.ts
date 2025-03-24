import { supabase } from "../config/configuration";

class TaskerModel {
  /**
   * Profile Creation for Tasker
   * @param tasker - {bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}
   * @returns
   */

  static async createTasker(
    tasker: {
      gender: Text;
      contact_number: Text;
      address: Text;
      birthdate: Text;
      profile_picture: string;
      user_id: number;
      bio: Text;
      specialization_id: number;
      skills: string;
      availability: boolean;
      wage_per_hour: number;
      tesda_documents_id: number;
      social_media_links: string[];
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
      .select("*")
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Update Tasker Information
   */
  static async update(
    tasker: {
      gender: Text;
      contact_number: Text;
      address: Text;
      birthdate: Text;
      profile_picture: string;
      bio: Text;
      skills: string;
      availability: boolean;
      wage_per_hour: number;
      social_media_links: string[] | string; // Allow string or string[]
    },
    withForeignKeys: {
      specialization: string;
      tesda_documents_link: string;
    },
    user: {
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
  
    const { data: tesda_documents, error: tesda_error } = await supabase
      .from("tasker_documents")
      .insert({ tesda_document_link: withForeignKeys.tesda_documents_link })
      .select("id")
      .single();
    if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);
  
    const { data: userData, error: userError } = await supabase
      .from("user")
      .update(user)
      .eq("user_id", user.user_id);
    if (userError) throw new Error(userError.message);
  
    // Sanitize social_media_links
    let sanitizedSocialMediaLinks: string[];
    if (typeof tasker.social_media_links === 'string') {
      sanitizedSocialMediaLinks = tasker.social_media_links === 'null' ? [] : [tasker.social_media_links];
    } else {
      sanitizedSocialMediaLinks = tasker.social_media_links ?? [];
    }
  
    const { data: taskerData, error: taskerError } = await supabase
      .from("tasker")
      .update({
        gender: tasker.gender,
        contact_number: tasker.contact_number,
        address: tasker.address,
        birthdate: tasker.birthdate,
        profile_picture: tasker.profile_picture,
        bio: tasker.bio,
        skills: tasker.skills,
        availability: tasker.availability,
        wage_per_hour: tasker.wage_per_hour,
        tesda_documents_id: tesda_documents.id,
        social_media_links: sanitizedSocialMediaLinks,
        specialization_id: specializations.spec_id,
      })
      .eq("user_id", user.user_id);
    console.log(taskerData, taskerError);
    if (taskerError) throw new Error(taskerError.message);
  
    return { userData, taskerData };
  }
}

export default TaskerModel;
