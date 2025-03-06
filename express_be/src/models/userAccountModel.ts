import { supabase } from "../config/configuration";

class UserAccount {
  /**
   * This section can only be accessed by the Admin Only, all users can only create and edit their user information.
   * @param userData
   * @returns
   */
  static async create(userData: {
    first_name: string;
    middle_name: string;
    last_name: string;
    birthdate: Date;
    email: string;
    image_link?: string;
    hashed_password: string;
    acc_status: string;
    user_role: string;
  }) {
    const { data, error } = await supabase.from("user").insert([userData]);

    if (error) throw new Error(error.message);
    return data;
  }

  static async showUser(user_id: string){
    const {data, error} = await supabase.from("user").select("first_name, middle_name, last_name, image_link, email, birthdate, user_role").eq("user_id", user_id).single()

    if(error) throw new Error(error.message);

    return data;
  }

  static async showClient(user_id: string) {
    const {data, error} = await supabase.from("clients").select("preferences, client_address").eq("user_id", user_id).single();

    if(error) throw new Error(error.message);

    return data;
  }

  static async showTasker(user_id: string){
    const {data, error} = await supabase.from("tasker").select("bio, tasker_specialization(specialization), skills, availability, wage_per_hour, tasker_documents(tesda_document_link), social_media_links, address").eq('user_id', user_id).single()

    if(error) throw new Error(error.message);

    return data;
  }
}

export { UserAccount };
