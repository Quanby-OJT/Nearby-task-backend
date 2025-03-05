import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { supabase } from "../config/configuration";
import { randomUUID } from "crypto";

class auth {
  constructor(public session: any) {}

  static async userInformation(req: Request, res: Response): Promise<any> {
    try {
      const { user_id } = req.body;

      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
      } else if (!data) {
        res.status(404).json({ error: "User not found" });
      } else {
        res.status(200).json({ user: data });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
  static async login(req: Request, res: Response): Promise<any> {
    try {
      const { email, password } = req.body;
      const userSession: any = {};

      // Fetch user details
      const { data: user, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", email)
        .in("user_role", ["admin", "moderator"])
        .maybeSingle();

      if (!user || error) {
        return res.status(404).json({ message: "User not found" });
      }

      // Validate password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.hashed_password
      );

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Password is incorrect" });
      }

      // Update user status
      const { error: updateError } = await supabase
        .from("user")
        .update({ status: true })
        .eq("user_id", user.user_id);

      if (updateError) {
        return res.status(500).json({ message: "Error updating user status" });
      }

      // Generate session ID
      const sessionID = randomUUID();
      const userID = user.user_id;
      const loggedIn = new Date().toISOString(); // Ensure proper timestamp format

      userSession[sessionID] = { user: user.user_id };

      // Check if session already exists
      const { data: existSession, error: sessionError } = await supabase
        .from("user_logs")
        .select("session")
        .eq("session", sessionID)
        .maybeSingle();

      if (!existSession) {
        // Insert new session log
        const { error: insertError } = await supabase.from("user_logs").insert([
          {
            session: sessionID,
            user_id: userID,
            logged_in: loggedIn,
          },
        ]);

        if (insertError) {
          console.error("Error inserting user log:", insertError);
          return res.status(500).json({ message: "Error inserting user log" });
        }
      }

      return res.status(200).json({
        message: "Logged in successfully",
        userSession: userSession,
      });
    } catch (err: any) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Error: " + err.message });
    }
  }

  static async logout(req: Request, res: Response): Promise<any> {
    try {
      const { userID, cleanedSessionID } = req.body;
      const loggedOut = new Date().toISOString();

      const { error } = await supabase
        .from("user")
        .update({ status: false })
        .eq("user_id", userID);

      if (error) {
        console.log(error);
        return res.status(500).json({ message: "Error updating user status" });
      }

      const { data: sessionExists, error: sessionError } = await supabase
        .from("user_logs")
        .select("session")
        .eq("session", cleanedSessionID)
        .single();

      if (sessionExists) {
        await supabase
          .from("user_logs")
          .update({ logged_out: loggedOut })
          .eq("session", cleanedSessionID);
      }

      if (sessionError) {
        console.error(
          "Error updating user log:",
          sessionError,
          cleanedSessionID
        );
        return res.status(500).json({ message: "Error updating user log" });
      }

      return res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
      return res.status(500).json({ message: "Error" + error });
    }
  }

  static async logoutWithoutSession(req: Request, res: Response): Promise<any> {
    const { sessionID } = req.body;
    const loggedOut = new Date().toISOString();

    try {
      const { data: sessionExists, error: sessionError } = await supabase
        .from("user_logs")
        .select("session")
        .eq("session", sessionID)
        .single();

      if (sessionExists) {
        await supabase
          .from("user_logs")
          .update({ logged_out: loggedOut })
          .eq("session", sessionID);

        return res.status(200).status(200).json({ message: "User logged out" });
      }

      if (sessionError) {
        console.error("Error updating user log:", sessionError, sessionID);
        return res.status(500).json({ message: "Error updating user log" });
      }

      return res.status(200).status(200).json({ message: "User logged out" });
    } catch (error) {
      return res.status(500).json({ message: "Error" + error });
    }
  }
}
export default auth;
