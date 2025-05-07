import { supabase } from "../config/configuration";

class User {
  /**
   * This section can only be accessed by the Admin Only, all users can only create and edit their user information.
   * @param userData
   * @returns
   */
  static async create(userData: {
    first_name: string;
    middle_name: string;
    last_name: string;
    email: string;
    hashed_password: string;
    image_link?: string;
  }) {
    const { data, error } = await supabase
      .from("user") // Dapat tama ang table name mo sa database
      .insert([userData]);

    if (error) throw new Error(error.message);
    return data;
  }
}

class Auth {
  /**
   * The following methods were meant for user authentication for both email and OTP.
   * @param email
   * @returns
   */

  static async insertLogData(user_id: number, session: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (error) {
        throw new Error("Database error while fetching user:" + error.message);
      }

      if (!data) {
        console.warn(`User with ID ${user_id} not found.`);
        return { error: "User not found" };
      }

      // Update user status
      const { error: updateError } = await supabase
        .from("user")
        .update({ status: true, verification_token: null, emailVerified: true })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating user status:", updateError.message);
        return { error: "Error updating user status" };
      }

      const { error: otpResetError } = await supabase.from("two_fa_code")
        .update({ two_fa_code: null, two_fa_code_expires_at: null })
        .eq("user_id", user_id);
        
      if (otpResetError) {
        console.error("Error resetting OTP:", otpResetError.message);
        return { error: "Error resetting OTP" };
      }

      const loggedIn = new Date().toISOString();

      const { error: errorInsert } = await supabase.from("user_logs").insert({
        user_id,
        session,
        logged_in: loggedIn,
      });

      if (errorInsert) {
        console.error("Error inserting user log:", errorInsert.message);
        return { error: "Error inserting user log" };
      }

      console.log(`User ID ${user_id} status updated successfully. ${session}`);
      console.log("Sesssion:" + session);

      return {
        success: true,
        data: { user_id: user_id, session: session },
      };
    } catch (error: any) {
      console.error("Unexpected error inserting log data:", error.message);
      return { error: "Unexpected error occurred" };
    }
  }

  static async authenticateLogin(email: string) {
    const { data, error } = await supabase
      .from("user")
      .select("user_id, email, hashed_password, acc_status")
      .eq("email", email)
      .in("user_role", ["Tasker", "Client"])
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(error.message);
    }
    return data;
  }

  //This will be changed once we start to implement the reset password link, which is already built-in within the application.
  static async getUserEmail(email: string) {
    const {data, error} = await supabase.from("users").select("email, acc_status").eq("email", email).single()

    if(error) throw new Error("Error while retrieving email" + error.message)

    if(!data) return null

    return data
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

    if (existingError && existingError.code !== "PGRST116") {
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

      console.log("Login success:", data); // Add logging
      return data;
    } else {
      const { data, error } = await supabase.from("two_fa_code").insert([otp]);

      if (error) {
        console.error("Error creating OTP:", error.message); // Add logging
        throw new Error(error.message);
      }

      console.log("OTP created successfully:", data); // Add logging
      return data;
    }
  }

  static async authenticateOTP(user_id: number) {
    //console.log(`Querying for user_id: ${user_id} (${typeof user_id})`); // Add logging

    const { data, error } = await supabase
      .from("two_fa_code")
      .select("two_fa_code, two_fa_code_expires_at")
      .eq("user_id", user_id)
      .maybeSingle(); // Allows 0 or 1 row without error

      console.log(data, error)

    if (error) {
      //console.error("Error authenticating OTP:", error.message); // Add logging
      throw new Error(error.message);
    }

    if (!data) {
      //console.warn("No OTP found for user_id:", user_id); // Add logging
      return null; // No OTP found for this user
    }

    //console.log("OTP authenticated successfully:", data); // Add logging
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
      //console.error("Error resetting OTP:", error.message); // Add logging
      throw new Error(error.message);
    }

    //console.log("OTP reset successfully:", data); // Add logging
    return data;
  }
  static async getUserById(user_id: string | number): Promise<any> {
    try {
      //console.log("Getting user by ID:", user_id); // Add logging

      const { data, error } = await supabase
        .from("user") // Changed from 'users' to 'user' to match your other queries
        .select("email, user_id")
        .eq("user_id", user_id)
        .single();

      if (error) {
        //console.error("Error getting user by ID:", error.message);
        throw error;
      }

      //console.log("User retrieved successfully:", data);
      return data;
    } catch (error) {
      //console.error("Error getting user by ID:", error);
      return null;
    }
  }

  static async getUserRole(user_id: number) {
    const { data, error } = await supabase
      .from("user")
      .select("user_role")
      .eq("user_id", user_id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async login(user_session: { user_id: number; session_key: string }) {
    const loggedInAt = new Date().toISOString(); // Converts timestamp to a proper string

    console.log(user_session);

    const { data, error } = await supabase.from("user_logs").insert({
      user_id: user_session.user_id,
      logged_in: loggedInAt, // Insert as a string
      session: user_session.session_key,
    });

    console.log("Logged Data:", data, "Error:", error);

    if (error) throw new Error(error.message);
    return data;
  }

  static async logout(user_id: number, session_key: string) {
    try {
      const loggedOutAt = new Date().toISOString();

        const { error: logError } = await supabase
        .from("user_logs")
        .update({ logged_out: loggedOutAt })
        .eq("user_id", user_id)
        .eq("session", session_key);

      if (logError) {
        throw new Error(`Error updating user_logs: ${logError.message}`);
      }

      // Update user status
      const { error: userError } = await supabase
      .from("user")
      .update({ status: false })
      .eq("user_id", user_id);

    if (userError) {
      throw new Error(`Error updating user status: ${userError.message}`);
    }

    return { success: true, message: "User logged out successfully" };
    } catch (error:any) {
      console.error("Logout Error:", error);
        return { success: false, message: error.message };
    }
  }
}

export { Auth };
