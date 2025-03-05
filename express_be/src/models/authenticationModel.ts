import session from "express-session";
import { supabase } from "../config/configuration";

// class User {

//   /**
//    * This section can only be accessed by the Admin Only, all users can only create and edit their user information.
//    * @param userData
//    * @returns
//    */
//   static async create(userData: { first_name: string; last_name: string; email: string; password: string; image?: string }) {
//     const { data, error } = await supabase
//       .from("demo") // Dapat tama ang table name mo sa database
//       .insert([userData]);

//     if (error) throw new Error(error.message);
//     return data;
//   }
// }

class Auth {
  /**
   * The following methods were meant for user authentication for both email and OTP.
   * @param email
   * @returns
   */

  static async authenticateLogin(email: string) {
    console.log("Authenticating login for email:", email); // Add logging

    const { data, error } = await supabase
      .from("user")
      .select("user_id, email, hashed_password")
      .eq("email", email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        console.warn("No user found for email:", email); // Add logging
        return null;
      }
      console.error("Error authenticating login:", error.message); // Add logging
      throw new Error(error.message);
    }

    console.log("Login authenticated successfully:", data); // Add logging
    return data;
  }

  static async createOTP(otp_input: { user_id: number; two_fa_code: string }) {
    const addMinutes = (date: number, n: number) => {
      const d = new Date(date);
      d.setTime(d.getTime() + n * 60_000);
      return d;
    };

    const otp = {
      ...otp_input,
      two_fa_code_expires_at: addMinutes(Date.now(), 20),
    };

    console.log("Creating OTP with data:", otp); // Add logging

    const { data: existingUser, error: existingError } = await supabase
      .from("two_fa_code")
      .select("two_fa_code, two_fa_code_expires_at")
      .eq("user_id", otp_input.user_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error("Error checking existing OTP:", existingError.message); // Add logging
      throw new Error(existingError.message);
    }

    if (existingUser) {
      const { data, error } = await supabase
        .from("two_fa_code")
        .update({
          two_fa_code: otp.two_fa_code,
          two_fa_code_expires_at: otp.two_fa_code_expires_at,
        })
        .eq("user_id", otp.user_id);

      if (error) {
        console.error("Error updating OTP:", error.message); // Add logging
        throw new Error(error.message);
      }

      console.log("OTP updated successfully:", data); // Add logging
      return data;
    } else {
      const { data, error } = await supabase
        .from("two_fa_code")
        .insert([otp]);

      if (error) {
        console.error("Error creating OTP:", error.message); // Add logging
        throw new Error(error.message);
      }

      console.log("OTP created successfully:", data); // Add logging
      return data;
    }
  }

  static async authenticateOTP(user_id: number) {
    console.log(`Querying for user_id: ${user_id} (${typeof user_id})`); // Add logging

    const { data, error } = await supabase
      .from("two_fa_code")
      .select("two_fa_code, two_fa_code_expires_at")
      .eq("user_id", user_id)
      .maybeSingle(); // Allows 0 or 1 row without error

    if (error) {
      console.error("Error authenticating OTP:", error.message); // Add logging
      throw new Error(error.message);
    }

    if (!data) {
      console.warn("No OTP found for user_id:", user_id); // Add logging
      return null; // No OTP found for this user
    }

    console.log("OTP authenticated successfully:", data); // Add logging
    return data;
  }

  static async resetOTP(user_id: number) {
    console.log("Resetting OTP for user_id:", user_id); // Add logging

    const { data, error } = await supabase
      .from("two_fa_code")
      .update({
        two_fa_code: null,
        two_fa_code_expires_at: null,
      })
      .eq("user_id", user_id);

    if (error) {
      console.error("Error resetting OTP:", error.message); // Add logging
      throw new Error(error.message);
    }

    console.log("OTP reset successfully:", data); // Add logging
    return data;
  }
  static async getUserById(user_id: string | number): Promise<any> {
    try {
      console.log("Getting user by ID:", user_id); // Add logging
      
      const { data, error } = await supabase
        .from('user')  // Changed from 'users' to 'user' to match your other queries
        .select('email, user_id')
        .eq('user_id', user_id)
        .single();
        
      if (error) {
        console.error("Error getting user by ID:", error.message);
        throw error;
      }
      
      console.log("User retrieved successfully:", data);
      return data;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      return null;
    }
  }
}

export { Auth };
