import { supabase } from "../config/configuration";

class TaskerModel {
  /**
   *
   * @param tasker - {bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}
   * @returns
   */

  static async createTasker(
    tasker: {
      gender: Text;
      contact_number: Text;
      address: Text;
      birthdate: Text;
      profile_picture: Text;
      user_id: number;
      bio: Text;
      specialization: Text;
      skills: Text;
      availability: boolean;
      wage_per_hour: number;
      tesda_documents_link: Text;
      social_media_links: Text;
    },
    contact_number: any,
    address: any,
    birthdate: any,
    profile_picture: any,
    user_id: any,
    bio: any,
    specialization: any,
    skills: any,
    availability: any,
    wage_per_hour: any,
    tesda_documents_link: any,
    social_media_links: any
  ) {
    const { data, error } = await supabase.from("tasker").insert([tasker]);
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
}

export default TaskerModel;
