import { Request, Response } from "express";
import { Auth } from "../models/authenticationModel";
import bcrypt from "bcrypt";
import generateOTP from "otp-generator";
import { mailer, supabase } from "../config/configuration";
import { randomUUID } from "crypto";
import renderEmail from "../emails/renderEmail";
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

class AuthenticationController {
  static async loginAuthentication(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const verifyLogin = await Auth.authenticateLogin(email);

      if (!verifyLogin) {
        res.status(404).json({
          error:
            "Sorry, your email does not exist, or you have entered an incorrect email.",
        });
        return;
      }

      if (verifyLogin.acc_status === "Ban" || verifyLogin.acc_status === "Block") {
        res.status(401).json({
          error:
            "You are banned/blocked for using this application. Please contact our team to appeal to your ban.",
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

      // Save OTP in database
      await Auth.createOTP({
        user_id: verifyLogin.user_id,
        two_fa_code: otp.toString(),
      });

      const name = `${verifyLogin.first_name} ${verifyLogin.last_name}`;

      const loginEmail = await renderEmail.renderOTPEmail(name, otp);

      if (loginEmail.error) {
        throw new Error('Failed to render email template');
      }

      await mailer.sendMail({
        from: '"QTask" <noreply@qtask.com>',
        to: email,
        subject: 'QTask OTP Code',
        html: loginEmail.toString(),
      });

      
      res.status(200).json({ 
        user_id: verifyLogin.user_id,
        otp: otp // Include OTP directly in response
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error:
          "An error occurred while verifying your email. If the issue persists, contact our team to resolve your issue.",
      });
    }
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const {email} = req.body;

    try {
      const verifyEmail = await Auth.getUserEmail(email);

      if (!verifyEmail) {
        res.status(404).json({
          error:
            "Sorry, your email does not exist. Maybe you can sign up to find your clients/taskers.",
        });
        return;
      }

      if (verifyEmail.acc_status === "Ban" || verifyEmail.acc_status === "Block") {
        res.status(401).json({error: "You are banned/blocked for using this application. Please contact our team to appeal to your ban.", });
        return;
      }

      const verificationToken = randomUUID()

      const {data, error} = await supabase.from("user").update({verification_token: verificationToken}).eq("email", email)

      console.log(data, error)

      if(error) throw new Error(error.message)


      const verificationLink = `myapp://verify?token=${verificationToken}&email=${email}`;
      console.log(verificationLink);

      // const html = `
      // <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
      //   <h2 class="text-xl font-bold text-gray-800">Your Reset Password Link</h2>
      //   <p class="text-gray-700 mt-4">Do you request to reset your password? If not, please ignore this message. If so, please click this link here: </p>
      //   <div class="mt-4 text-center">
      //     <span class="text-3xl font-bold text-blue-600">${verificationLink}</span>
      //   </div>
      //   <p class="text-red-500 mt-4">Note: This verification link will expire 30 minutes from now.</p>
      //   <p class="text-gray-500 mt-6 text-sm">Should you have any concerns, please don't hesitate to contact us.</p>
      //   <p class="text-gray-500 mt-6 text-sm">Cheers.</p>
      //   <p class="text-gray-500 mt-6 text-sm">IMONALICK Team.</p>
      // </div>`;

      // await mailer.sendMail({
      //   from: "noreply@nearbytask.com",
      //   to: verifyEmail.email,
      //   subject: "Rest IMONALICK Password",
      //   html: html,
      // });

      
      res.status(200).json({message: "Password reset link has been sent to your email. Please check your inbox."});

    }catch(error){
      console.error(error instanceof Error ? error.message : "Internal Server Error")
      res.status(500).json({error: "An error occured while verifying your email. Please Try Again. If the problem persists. Contact us."})
    }
  }

  //To be changed 
  static async resetPassword(req: Request, res: Response): Promise<void> {
    const {email, password, verification_token} = req.body

    const hashedPassword = await bcrypt.hash(password, 10)

    try {
      const { data: user } = await supabase
        .from("user")
        .select("hashed_password")
        .eq("email", email)
        .single();

      if (user) {
        const isSamePassword = await bcrypt.compare(password, user.hashed_password);
        if (isSamePassword) {
          res.status(400).json("New password cannot be the same as the current password");
          return
        }
      }

      const {error} = await supabase
        .from("user")
        .update({hashed_password: hashedPassword})
        .eq("email", email);
  
        if(error) throw new Error(error.message)
  
        const {error: errorDelete} = await supabase.from("user").update({verification_token: null}).eq("email", email).eq("verification_token", verification_token)
  
        if(errorDelete) throw new Error(errorDelete.message)
  
        res.status(200).json({message: "Password has been reset successfully. Please login to your account."})
      }catch(error){
        console.error(error instanceof Error ? error.message : "Internal Server Error")
        res.status(500).json({error: "An error occured while resetting your password. Please Try Again. If the problem persists. Contact us."})
      }
  }

  static async generateOTP(req: Request, res: Response): Promise<void> {
    try {
      const { user_id } = req.body;
      console.log(user_id);

      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      await Auth.createOTP({ user_id: user_id, two_fa_code: otp });

      // Return OTP directly in response instead of sending email
      res.status(200).json({
        message: "Successfully Generated OTP",
        otp: otp
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

      console.log("User Id: " + user_id + " OTP :" + otp);

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
      const sessionToken = randomUUID();

      const userLogin = await Auth.insertLogData(user_id, sessionToken);

      res.cookie("session", userLogin.session, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });

      // Fetch user role
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("user_role, acc_status")
        .eq("user_id", user_id)
        .single();

      if (userError) {
        console.error("Error fetching user role:", userError.message);
        res.status(500).json({ error: "Failed to fetch user role" });
        return;
      }

      console.log("Data: ", {
        user_id: user_id,
        user_role: user.user_role,
        session: userLogin.session,
      });

      res.status(200).json({
        user_id: user_id,
        user_role: user.user_role,
        session: sessionToken,
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
      const user = await Auth.getUserById(user_id);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Generate a new OTP
      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      // Update the OTP in the database
      await Auth.createOTP({
        user_id,
        two_fa_code: otp,
      });

      // Return OTP directly in response instead of sending email
      res.status(200).json({ 
        message: "OTP reset successfully", 
        otp: otp 
      });
    } catch (error) {
      console.error("Error in resetOTP:", error);
      res.status(500).json({
        error: "An error occurred while resetting OTP. Please try again.",
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const { user_id, session } = req.body;
    console.log("User ID for logout:", user_id);
    console.log("Session for logout:", session);

    Auth.logout(user_id, session);

    if (req.session.id) {
      req.session.destroy((error) => {
        if (error) {
          res.status(500).json({
            error: "An error occurred while logging out. Please try again.",
          });
        }

        res.clearCookie("cookie.sid");

        res.status(200).json({ message: "Successfully logged out." });
      });
    } else {
      res.status(400).json({ error: "User is not logged in." });
      return;
    }
  }
}

export default AuthenticationController;
