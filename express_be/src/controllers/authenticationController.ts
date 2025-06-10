import { Request, Response } from "express";
import { Auth } from "../models/authenticationModel";
import bcrypt from "bcrypt";
import generateOTP from "otp-generator";
import { supabase, mailer } from "../config/configuration";
import { randomUUID } from "crypto";
import ActivityLogging from "../models/activityLogs";
import renderEmail from "../emails/renderEmail";
import nodemailer from "nodemailer";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}


class AuthenticationController {
  static async loginAuthentication(req: Request, res: Response): Promise<void> {
    console.log("Login Authentication Controller");
    try {
      const { email, password } = req.body;
      console.log("Email: " + email + " Password: " + password);
      // Check login attempts
      const attempts = await Auth.getLoginAttempts(email);
      console.log("Attempts: " + attempts);
      if (attempts >= 3) {
        res.status(429).json({ 
          error: "Too many failed login attempts. Please try again after 5 minutes.",
          remainingTime: 300 // 5 minutes in seconds
        });
        return;
      }

      const verifyLogin = await Auth.authenticateLogin(email);
      console.log("Verify Login: " + verifyLogin);
      if (!verifyLogin) {
        await Auth.incrementLoginAttempts(email);
        res.status(404).json({ 
          error: "Sorry, your email does not exist, or you have entered an incorrect email.",
          attemptsLeft: 3 - (attempts + 1)
        });
        return;
      }

      if (verifyLogin.acc_status === "Ban" || verifyLogin.acc_status === "Block") {
        res.status(401).json({ 
          error: "You are banned/blocked for using this application. Please contact our team to appeal to your ban." 
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, verifyLogin.hashed_password);
      if (!isPasswordValid) {
        await Auth.incrementLoginAttempts(email);
        res.status(414).json({ 
          error: "Password is incorrect. Please try again.",
          attemptsLeft: 3 - (attempts + 1)
        });
        return;
      }

      // Reset login attempts on successful login
      await Auth.resetLoginAttempts(email);

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

      const name = verifyLogin.first_name;
      const last_name = verifyLogin.last_name;

      await ActivityLogging.logActivity(
        verifyLogin.user_id,
        "Login",
        `User ${name} logged in successfully. Generating OTP for two-factor authentication.`
      );
      req.session.userId = verifyLogin.user_id;

      const html = `
     <!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      text-align: left;
    }
    .heading {
      color: #000000;
      text-transform: uppercase;
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 90px;
    }
    .greeting {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 10px;
    }
    .body-text {
      font-size: 14px;
      margin-bottom: 15px;
      color: #333333;
    }
    .body-text.last {
      margin-bottom: 30px;
    }
    .otp {
      font-size: 14px;
      margin: 20px 0;
      color: #333333;
    }
    .otp .code {
      font-weight: bold;
      color: #007bff;
    }
    .closing {
      font-size: 14px;
      margin-bottom: 30px;
      color: #333333;
    }
    .footer {
      text-align: right;
      font-size: 12px;
      color: #777777;
      margin-top: 20px;
    }
    .footer img {
      width: 40px;
      height: auto;
      display: inline-block;
      vertical-align: middle;
      margin-right: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://tzdthgosmoqepbypqbbu.supabase.co/storage/v1/object/public/email-template-images//NearbTask.png" alt="NearbTask" style="width: 60px; height: auto; display: inline-block; vertical-align: middle;">
    </div>

    <h1 class="heading">Welcome to QTask</h1>

    <p class="greeting">Hi ${name} ${last_name} !</p>
    <p class="body-text">We received a request to login to your account. Please use the One-Time Password (OTP) below to proceed:</p>
    <p class="otp">Your OTP Code: <span class="code">${otp}</span></p>
    <p class="body-text last">This code is valid for the next 5 minutes. If you didn't request a login, you can safely ignore this email.</p>

    <p class="closing">Thank you,<br>The QTask Team</p>

    <div class="footer">
      <img src="https://tzdthgosmoqepbypqbbu.supabase.co/storage/v1/object/public/email-template-images//Quanby.png" alt="Quanby">
      <span>From Quanby Solutions Inc</span>
    </div>
  </div>
</body>
</html>
      `;

      try {
        await mailer.verify();
        console.log('SMTP connection verified');
      } catch (verifyError) {
        console.error('SMTP verification failed:', verifyError);
        throw new Error('Email service not available');
      }


      try {
        await mailer.sendMail({
          from: `"QTask" <${process.env.MAIL_USERNAME}>`,
          to: email,
          subject: 'NearbyTask Login Verification',
          html: html
        });
        console.log('Email sent successfully');
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        throw new Error('Failed to send OTP email');
      }

      res.status(200).json({
        user_id: verifyLogin.user_id,
        otp: otp
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "An error occurred while verifying your email. If the issue persists, contact our team to resolve your issue.",
      });
    }
  }


  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body;

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
        res.status(401).json({ error: "You are banned/blocked for using this application. Please contact our team to appeal to your ban.", });
        return;
      }

      const verificationToken = randomUUID()

      const { data, error } = await supabase.from("user").update({ verification_token: verificationToken }).eq("email", email)

      console.log(data, error)

      if (error) throw new Error(error.message)


      const verificationLink = `myapp://verify?token=${verificationToken}&email=${email}`;
      console.log(verificationLink);

      const html = `
      <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
        <h2 class="text-xl font-bold text-gray-800">Your Reset Password Link</h2>
        <p class="text-gray-700 mt-4">Do you request to reset your password? If not, please ignore this message. If so, please click this link here: </p>
        <div class="mt-4 text-center">
          <span class="text-3xl font-bold text-blue-600">${verificationLink}</span>
        </div>
        <p class="text-red-500 mt-4">Note: This verification link will expire 30 minutes from now.</p>
        <p class="text-gray-500 mt-6 text-sm">Should you have any concerns, please don't hesitate to contact us.</p>
        <p class="text-gray-500 mt-6 text-sm">Cheers.</p>
        <p class="text-gray-500 mt-6 text-sm">IMONALICK Team.</p>
      </div>`;

      await mailer.sendMail({
        from: "noreply@nearbytask.com",
        to: verifyEmail.email,
        subject: "Rest IMONALICK Password",
        html: html,
      });

      await ActivityLogging.logActivity(
        verifyEmail.user_id,
        "Forgot Password",
        `User with email ${email} requested a password reset. Verification token generated.`
      );
      res.status(200).json({ message: "Password reset link has been sent to your email. Please check your inbox." });

    } catch (error) {
      console.error(error instanceof Error ? error.message : "Internal Server Error")
      res.status(500).json({ error: "An error occured while verifying your email. Please Try Again. If the problem persists. Contact us." })
    }
  }

  //To be changed 
  static async resetPassword(req: Request, res: Response): Promise<void> {
    const { email, password, verification_token } = req.body

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

      const { error } = await supabase
        .from("user")
        .update({ hashed_password: hashedPassword })
        .eq("email", email);

      if (error) throw new Error(error.message)

      const { error: errorDelete } = await supabase.from("user").update({ verification_token: null }).eq("email", email).eq("verification_token", verification_token)

      if (errorDelete) throw new Error(errorDelete.message)

      await ActivityLogging.logActivity(
        email,
        "Reset Password",
        `User with email ${email} has successfully reset their password.`
      );
      console.log(`User with email ${email} has successfully reset their password.`);
      res.status(200).json({ message: "Password has been reset successfully. Please login to your account." })
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Internal Server Error")
      res.status(500).json({ error: "An error occured while resetting your password. Please Try Again. If the problem persists. Contact us." })
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

      await ActivityLogging.logActivity(
        user_id,
        "Login",
        `User with ID ${user_id} logged in successfully. Session token generated: ${sessionToken}`
      );
      // Clear OTP after successful login
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

      await ActivityLogging.logActivity(
        user_id,
        "Reset OTP",
        `User with ID ${user_id} has successfully reset their OTP.`
      );

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

    await Auth.logout(user_id, session);
    await ActivityLogging.logActivity(
      user_id,
      "Logout",
      `User with ID ${user_id} logged out successfully.`
    );
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
