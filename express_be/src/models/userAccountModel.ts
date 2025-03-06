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
}

export { UserAccount };
