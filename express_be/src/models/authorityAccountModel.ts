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
}

export { AuthorityAccount };