import { mailer, supabase } from "../config/configuration";
import { Request, Response } from "express";
import { AuthorityAccount } from "../models/authorityAccountModel";
import bcrypt from "bcrypt";
import path from "path"; 
import crypto from "crypto";
import nodemailer from "nodemailer";

class AuthorityAccountController {
  static async addAuthorityUser(req: Request, res: Response): Promise<any> {
    try {
      const {
        first_name,
        middle_name,
        last_name,
        birthday,
        email,
        password,
        acc_status,
        user_role,
        contact,
        gender,
      } = req.body;
      const imageFile = req.file;
      console.log("Received authority account data:", req.body);

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ errors: "Email already exists" });
      }

      if (findError && findError.message !== "No rows found") {
        throw new Error(findError.message);
      }

      let imageUrl = null;
      if (imageFile) {
        const fileName = `users/${Date.now()}_${imageFile.originalname}`;
        const { error: uploadError } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, imageFile.buffer, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData?.publicUrl || null;
      }

      const userData: any = {
        first_name,
        middle_name,
        last_name,
        birthdate: birthday,
        email,
        user_role,
        contact,
        gender,
        image_link: imageUrl,
        acc_status: acc_status || "Review",
        emailVerified: true,
        verified: true,
        verification_token: null,
      };

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        userData.hashed_password = hashedPassword;
      } else {
        userData.hashed_password = null;
      }

      const { data: newUser, error: insertError } = await supabase
        .from("user")
        .insert([userData])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      res.status(201).json({
        message: "Authority user added successfully.",
        user: {
          id: newUser.user_id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
        },
      });
    } catch (error) {
      console.error("Authority addition error:", error);
      res.status(500).json({
        errors:
          error instanceof Error
            ? error.message
            : "An error occurred during authority user addition",
      });
    }
  }

  static async updateAuthorityUser(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        birthday,
        email,
        user_role,
        contact,
        gender,
        acc_status,
      } = req.body;
      const imageFile = req.file;

      const { data: existingUser, error: findError } = await supabase.from("user").select("email, user_id").eq("email", email).neq("user_id", userId).maybeSingle();
      if (findError && findError.message !== "No rows found") {
        throw new Error(findError.message);
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      let imageUrl = null;
      if (imageFile) {
        const fileName = `users/${Date.now()}_${imageFile.originalname}`;
        const { error: uploadError } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, imageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData?.publicUrl || null;
      }

      const updateData: any = {
        first_name,
        middle_name,
        last_name,
        birthdate: birthday,
        email,
        user_role,
        contact,
        gender,
        acc_status,
        verified: true,
      };

      if (imageUrl) {
        updateData.image_link = imageUrl;
      }

      const updatedUser = await AuthorityAccount.update(userId, updateData);

      if (acc_status === "Active" && updatedUser.user_role === "Tasker") {
        await AuthorityAccount.updateTaskerDocumentsValid(userId.toString(), true);
      }

      res.status(200).json({
        message: "Authority user updated successfully.",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Authority update error:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "An error occurred during authority user update",
      });
    }
  }

  static async getUserData(req: Request, res: Response): Promise<any> {
    console.log("Request: ", req.body);
    try {
      const userID = req.params.id;
      console.log("Retrieving User Data for..." + userID);

      const userData = await AuthorityAccount.showUser(userID);
      if (userData.user_role === "Client") {
        const clientData = await AuthorityAccount.showClient(userID);
        res.status(200).json({ user: userData, client: clientData });
        console.log("Client Data: " + clientData);
      } else if (userData.user_role === "Tasker") {
        const taskerData = await AuthorityAccount.showTasker(userID);
        console.log("Tasker Data: " + taskerData);
        res.status(200).json({ userme: true, user: userData, taskerData: taskerData });
      } else {
        res.status(200).json({ user: userData });
        console.log("User Data (Other Role): ", userData);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unknown error");
      console.error(error instanceof Error ? error.stack : "Unknown error");
      res.status(500).json({
        error: "An Error Occurred while Retrieving Your Information. Please try again.",
      });
    }
  }

  static async getUserDocs(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.id;
      console.log("Retrieving User Document for..." + userID);
      const userDocs = await AuthorityAccount.getUserDocs(userID);
      console.log("User Document: " + userDocs);
      res.status(200).json({ user: userDocs });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async viewDocument(req: Request, res: Response): Promise<any> {
    try {
      const fileName = req.params.fileName;
      if (!fileName) {
        return res.status(400).json({ error: "File name is required" });
      }
  
      const bucketName = "crud_bucket";
  
  
      const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
      console.log("Fetching file from:", fileUrl);
  
      // Fetch the file from Supabase
      const response = await fetch(fileUrl);
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: "File not found in Supabase Storage" });
        }
        throw new Error(`Failed to fetch the document from Supabase Storage: ${response.statusText}`);
      }
  
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
  
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Content-Length", buffer.length);
  
      res.send(buffer);
    } catch (error) {
      console.error("Error serving document:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to serve the document",
      });
    }
  }

  static async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Check if email exists in the user table
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        res.status(404).json({ error: "Email not found" });
        return;
      }

      // Generate a 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();

      // Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Check if an OTP record already exists for this user
      const { data: existingOtpRecord, error: fetchError } = await supabase
        .from("two_fa_code")
        .select("code_id")
        .eq("user_id", user.user_id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") { 
        throw new Error(fetchError.message);
      }

      if (existingOtpRecord) {
        // Update the existing OTP record
        const { error: updateError } = await supabase
          .from("two_fa_code")
          .update({
            two_fa_code: otp,
            two_fa_code_expires_at: expiresAt,
          })
          .eq("user_id", user.user_id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        // Insert a new OTP record if none exists
        const { error: insertError } = await supabase
          .from("two_fa_code")
          .insert({
            user_id: user.user_id,
            two_fa_code: otp,
            two_fa_code_expires_at: expiresAt,
          });

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      // Send OTP via email using the existing mailer configuration
      await mailer.sendMail({
        from: process.env.MAIL_USERNAME,
        to: email,
        subject: "Your OTP for Password Reset",
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
      });

      res.status(200).json({ message: "OTP sent to your email" });
    } catch (error) {
      console.error("Error in sendOtp:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to send OTP" });
    }
  }

  static async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;

      // Log the received OTP for debugging
      console.log("Received OTP:", otp, "Type:", typeof otp);

      // Ensure OTP is treated as a string and trim any whitespace
      const otpString = String(otp).trim();

      // Get user
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        res.status(404).json({ error: "Email not found" });
        return;
      }

      // Check OTP in two_fa_code table
      const { data: otpRecord, error: otpError } = await supabase
        .from("two_fa_code")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("two_fa_code", otpString)
        .single();

      if (otpError || !otpRecord) {
        console.log("OTP verification failed. Error:", otpError, "Record:", otpRecord);
        res.status(400).json({ error: "Invalid OTP" });
        return;
      }

      // Check if OTP is expired
      const now = new Date();
      const expiresAt = new Date(otpRecord.two_fa_code_expires_at);
      if (now > expiresAt) {
        res.status(400).json({ error: "OTP has expired" });
        return;
      }

      res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
      console.error("Error in verifyOtp:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to verify OTP" });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, newPassword, confirmPassword } = req.body;

      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: "Passwords do not match" });
        return;
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        res.status(404).json({ error: "Email not found" });
        return;
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in user table
      const { error: updateError } = await supabase
        .from("user")
        .update({ hashed_password: hashedPassword })
        .eq("user_id", user.user_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Delete the used OTP from two_fa_code table
      await supabase.from("two_fa_code").delete().eq("user_id", user.user_id);

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error in resetPassword:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to reset password" });
    }
  }

  static async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, newPassword } = req.body;

      // Validate input
      if (!email || !newPassword) {
        res.status(400).json({ error: "Email and new password are required" });
        return;
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("user_id")
        .eq("email", email)
        .single();

      if (userError || !user) {
        res.status(404).json({ error: "Email not found" });
        return;
      }

      // Validate password requirements
      const passwordRegex = /^(?!.*\s)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()]).{8,}$/;
      if (!passwordRegex.test(newPassword)) {
        res.status(400).json({
          error: "Password must be at least 8 characters long, contain at least one lowercase letter, one uppercase letter, one number, one special character (!@#$%^&*()), and no spaces."
        });
        return;
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in user table
      const { error: updateError } = await supabase
        .from("user")
        .update({ hashed_password: hashedPassword })
        .eq("user_id", user.user_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error in updatePassword:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update password" });
    }
  }

  static async addAddress(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, street, barangay, city, province, postal_code, country, latitude, longitude, default: isDefault } = req.body;

      if (!user_id || !street || !barangay || !city || !province || !postal_code || !country) {
        res.status(400).json({ error: "Required fields (user_id, street, barangay, city, province, postal_code, country) are missing" });
        return;
      }

      const addressData = {
        user_id,
        street,
        barangay,
        city,
        province,
        postal_code,
        country,
        latitude: latitude || null,
        longitude: longitude || null,
        default: isDefault || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from("address").insert([addressData]).select();

      if (error) throw new Error(error.message);

      res.status(201).json({ message: "Address added successfully", addresses: data });
    } catch (error) {
      console.error("Error in addAddress:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to add address" });
    }
  }

  static async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const addressId = req.params.addressId;
      const { user_id, street, barangay, city, province, postal_code, country, latitude, longitude, default: isDefault } = req.body;

      if (!addressId || !user_id || !street || !barangay || !city || !province || !postal_code || !country) {
        res.status(400).json({ error: "Required fields (addressId, user_id, street, barangay, city, province, postal_code, country) are missing" });
        return;
      }

      const addressData = {
        user_id,
        street,
        barangay,
        city,
        province,
        postal_code,
        country,
        latitude: latitude || null,
        longitude: longitude || null,
        default: isDefault || false,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from("address").update(addressData).eq("id", addressId).select();

      if (error) throw new Error(error.message);

      res.status(200).json({ message: "Address updated successfully", addresses: data });
    } catch (error) {
      console.error("Error in updateAddress:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update address" });
    }
  }

  static async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;

      const { data, error } = await supabase.from("address").select("*").eq("user_id", userId);

      if (error) throw new Error(error.message);

      res.status(200).json({ message: "Addresses retrieved successfully", addresses: data });
    } catch (error) {
      console.error("Error in getAddresses:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to retrieve addresses" });
    }
  }
}

export default AuthorityAccountController;