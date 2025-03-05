import { Request, Response } from "express";
import { Auth } from "../models/authenticationModel";
import bcrypt from "bcrypt";
import generateOTP from "otp-generator";
import { mailer } from "../config/configuration";
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
        res.status(404).json({ error: "Sorry, your email does not exist. Maybe you can sign up to find your clients/taskers." });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, verifyLogin.hashed_password);
      if (!isPasswordValid) {
        res.status(414).json({ error: "Password is incorrect. Please try again." });
        return;
      }

            const otp = generateOTP.generate(6, {
                digits: true,
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
            })
    
            await Auth.createOTP({ user_id: verifyLogin.user_id, two_fa_code: otp })
            
            /**
             * Beyond this point, to reduce the mail being sent, I will temporarily comment out the mailer.sendMail function.
             * 
             * -Ces
             */

            // const otpHtml = `
            // <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
            //   <h2 class="text-xl font-bold text-gray-800">🔒 Your OTP Code</h2>
            //   <p class="text-gray-700 mt-4">In order to use the application, enter the following OTP:</p>
            //   <div class="mt-4 text-center">
            //     <span class="text-3xl font-bold text-blue-600">${otp}</span>
            //   </div>
            //   <p class="text-red-500 mt-4">Note: This OTP will expire 5 minutes from now.</p>
            //   <p class="text-gray-500 mt-6 text-sm">If you didn't request this code, please ignore this email.</p>
            // </div>`
          

            // await mailer.sendMail({
            //     from: "noreply@nearbytask.com",
            //     to: email,
            //     subject: "Your OTP Code for NearByTask",
            //     html: otpHtml
            // })

      res.status(200).json({ user_id: verifyLogin.user_id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An error occurred while logging in. If the issue persists, contact the Administrator." });
    }
  }

  static async generateOTP(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;

      const otp = generateOTP.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });

      await Auth.createOTP({ user_id: userId, two_fa_code: otp });

      res.status(200).json({ message: "Successfully Regenerated OTP. Please Check Your Email." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An Error Occurred while regenerating OTP. Please Try Again. If Issue persists, contact the Administrator." });
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
        res.status(401).json({ error: "Your OTP has expired. Please Sign In again." });
        return;
      }

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
      res.status(500).json({error:"An error occurred while verifying OTP. If the issue persists, contact Us."});
    }
  }
  
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