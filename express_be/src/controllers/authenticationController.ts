import { supabase } from "./../config/configuration";
import { Request, Response } from "express";
import { Auth } from "../models/authenticationModel";
import bcrypt from "bcrypt";
import generateOTP from "otp-generator";
import { mailer, supabase } from "../config/configuration";
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

class AuthenticationController {
  static async logout(req: Request, res: Response): Promise<any> {
    try {
      const { user_id, session } = req.body;
      const loggedOutTime = new Date().toISOString();

      if (!user_id || !session) {
        return res
          .status(400)
          .json({ message: "User ID or session is missing" });
      }

      console.log(`Logging out User ID: ${user_id}, Session: ${session}`);

      const { error: errorUpdate } = await supabase
        .from("user")
        .update({ status: false })
        .eq("user_id", user_id)
        .single();

      if (errorUpdate) {
        console.error("Error updating user status:", errorUpdate.message);
        return res
          .status(500)
          .json({ message: "Failed to update user status" });
      }

      const { data: sessionExist, error: errorSession } = await supabase
        .from("user_logs")
        .select("session")
        .eq("session", session)
        .single();

      if (errorSession) {
        console.error(
          "Error checking session existence:",
          errorSession.message
        );
        return res.status(500).json({ message: "Failed to check session" });
      }

      if (sessionExist) {
        const { error: logError } = await supabase
          .from("user_logs")
          .update({ logged_out: loggedOutTime })
          .eq("session", session);

        if (logError) {
          console.error("Error updating user log:", logError.message);
          return res.status(500).json({ message: "Error updating user log" });
        }
      }

      return res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
      console.error("Logout Error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
  static async loginAuthentication(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const verifyLogin = await Auth.authenticateLogin(email);

      if (!verifyLogin) {
        res.status(404).json({
          error:
            "Sorry, your email does not exist. Maybe you can sign up to find your clients/taskers.",
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        verifyLogin.hashed_password
      );
      if (!isPasswordValid) {
        res
          .status(414)
          .json({ error: "Password is incorrect. Please try again." });
        return;
      }

      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      await Auth.createOTP({ user_id: verifyLogin.user_id, two_fa_code: otp });

      const otpHtml = `
        <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
          <h2 class="text-xl font-bold text-gray-800">🔒 Your OTP Code</h2>
          <p class="text-gray-700 mt-4">In order to use the application, enter the following OTP:</p>
          <div class="mt-4 text-center">
            <span class="text-3xl font-bold text-blue-600">${otp}</span>
          </div>
          <p class="text-red-500 mt-4">Note: This OTP will expire 5 minutes from now.</p>
          <p class="text-gray-500 mt-6 text-sm">If you didn't request this code, please ignore this email.</p>
        </div>`;

      await mailer.sendMail({
        from: "noreply@nearbytask.com",
        to: email,
        subject: "Your OTP Code for NearByTask",
        html: otpHtml,
      });

      res.status(200).json({ user_id: verifyLogin.user_id });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error:
          "An error occurred while logging in. If the issue persists, contact the Administrator.",
      });
    }
  }

  static async generateOTP(req: Request, res: Response): Promise<void> {
    try {
      const { user_id } = req.body;
      console.log(user_id)

      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      await Auth.createOTP({ user_id: user_id, two_fa_code: otp });

      res.status(200).json({
        message: "Successfully Regenerated OTP. Please Check Your Email.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error:
          "An Error Occurred while regenerating OTP. Please Try Again. If Issue persists, contact the Administrator.",
      });
    }
  }

  static async otpAuthentication(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, otp } = req.body;
      const verifyOtp = await Auth.authenticateOTP(user_id);

      if (verifyOtp == null) {
        res.status(401).json({ error: "Please Login again" });
        return;
      }

      if (verifyOtp.two_fa_code !== otp) {
        res.status(401).json({ error: "Invalid OTP. Please try again." });
        return;
      }

      if (Date.parse(verifyOtp.two_fa_code_expires_at) <= Date.now()) {
        res
          .status(401)
          .json({ error: "Your OTP has expired. Please Sign In again." });
        return;
      }

      req.session.userId = user_id;

      const { data, error } = await Auth.insertLogData(user_id);
      if (error) {
        console.error(error);
      }

      res.cookie("session", data.session, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });

      console.log("Session: ", data.session);

      res.status(200).json({ user_id: user_id });

      const { data: user, error } = await supabase
        .from("user")
        .select("user_role")
        .eq("user_id", user_id)
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
// UNCOMMENT FOR TESTING
//       req.session.userId = user_id; // Assign to a writable property
//       res.status(200).json({ user_id: user_id, user_role: user.user_role });

      const session_id = req.sessionID
      //console.log(session_id)

      await Auth.resetOTP(user_id)
      const userRole = await Auth.getUserRole(user_id)
      await Auth.login({user_id, session_key: session_id})

      req.session.regenerate((err) => {
          if (err) {
              console.error("Session regeneration error:", err);
              return res.status(500).json({ error: "Session error" });
          }
          
          req.session.save((err) => {
              if (err) {
                  console.error("Session save error:", err);
              }
              //console.log("Session after save:", req.session);
              res.status(200).json({ user_id: user_id, user_role: userRole.user_role, session_id: session_id});
          });
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "An error occurred while verifying OTP. Please try again.",
      });
    }
  }

  static async resetOTP(req: Request, res: Response): Promise<void> {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }


      // Get the user's email using the user_id
      // We need to fetch the user's email from the database using the user_id
      // This will depend on your database structure and model methods

      // Assuming you have a method to get user by ID that returns user with email
      const user = await Auth.getUserById(user_id);

      if (!user || !user.email) {
        res
          .status(404)
          .json({ error: "User not found or email not available" });
        return;
      }


      // Generate a new OTP
      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });


      // Calculate expiration time (5 minutes from now)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Update the OTP in the database
      await Auth.createOTP({
        user_id,
        two_fa_code: otp,
        //two_fa_code_expires_at: expiresAt
      });

      // Create email template for OTP
      const otpHtml = `
        <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
          <h2 class="text-xl font-bold text-gray-800">🔒 Your OTP Code</h2>
          <p class="text-gray-700 mt-4">In order to use the application, enter the following OTP:</p>
          <div class="mt-4 text-center">
            <span class="text-3xl font-bold text-blue-600">${otp}</span>
          </div>
          <p class="text-red-500 mt-4">Note: This OTP will expire 5 minutes from now.</p>
          <p class="text-gray-500 mt-6 text-sm">If you didn't request this code, please ignore this email.</p>
        </div>`;

      // Send the email
      await mailer.sendMail({
        from: "noreply@nearbytask.com",
        to: user.email,
        subject: "Your OTP Code for NearByTask",
        html: otpHtml,
      });

      res.status(200).json({ message: "OTP reset and sent successfully" });
    } catch (error) {
      console.error("Error in resetOTP:", error);
      res.status(500).json({
        error: "An error occurred while resetting OTP. Please try again.",
      });

  
  static async logout(req: Request, res: Response): Promise<void> {
    if (req.session) {
      req.session.destroy((error) => {
        if(error) {
          res.status(500).json({ error: "An error occurred while logging out. Please try again." });
        }
        
        res.clearCookie("cookie.sid");
        
          res.status(200).json({ message: "Successfully logged out." });
          // req.session.regenerate((error) => {
          //     if (error) {
          //         res.status(500).json({ error: "An error occurred while logging out. Please try again." })
          //         return
          //     }
          // })
      })
    } else {
      res.status(400).json({ error: "User is not logged in." });
      return;

    }
  }
}

export default AuthenticationController;
