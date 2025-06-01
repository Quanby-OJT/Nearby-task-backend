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
        added_by,
        action_reason,
      } = req.body;
      const imageFile = req.file;
      console.log("Received authority account data:", req.body);

      // Validate added_by and action_reason
      if (!added_by || isNaN(Number(added_by))) {
        return res.status(400).json({ errors: "Invalid user ID for added_by" });
      }
      if (!action_reason) {
        return res.status(400).json({ errors: "Reason for adding user is required" });
      }

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
        added_by: added_by || null,
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

      // Insert into action_taken_by table
      const { error: actionError } = await supabase
        .from("action_taken_by")
        .insert({
          user_id: Number(added_by),
          action_reason,
          created_at: new Date().toISOString(),
        });

      if (actionError) {
        console.error("Error inserting into action_taken_by:", actionError);
        // Optionally, rollback user insertion if action logging fails
        await supabase.from("user").delete().eq("user_id", newUser.user_id);
        throw new Error("Failed to log action: " + actionError.message);
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
        action_by,
        added_by,
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
        action_by,
        added_by,
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

  static async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      const { userData, loggedInUserId, reason } = req.body;
  
      if (isNaN(userId)) {
        res.status(400).json({ success: false, message: "Invalid user ID" });
        return;
      }
  
      if (!loggedInUserId || isNaN(loggedInUserId)) {
        res.status(400).json({ success: false, message: "Invalid logged-in user ID" });
        return;
      }
  
      if (!reason) {
        res.status(400).json({ success: false, message: "Reason for updating status is required" });
        return;
      }
  
      if (!userData || !userData.acc_status || !userData.user_role) {
        res.status(400).json({ success: false, message: "Missing required user data (acc_status or user_role)" });
        return;
      }
  
      // Validate that loggedInUserId exists in the user table
      const { data: userExists, error: userCheckError } = await supabase
        .from("user")
        .select("user_id")
        .eq("user_id", parseInt(loggedInUserId))
        .single();
  
      if (userCheckError || !userExists) {
        console.error("User does not exist:", userCheckError || "No user found");
        res.status(400).json({
          success: false,
          message: "Logged-in user does not exist in the system",
        });
        return;
      }
  
      // Insert into action_taken_by with user_id and reason
      const { data: actionData, error: actionError } = await supabase
        .from("action_taken_by")
        .insert({
          user_id: parseInt(loggedInUserId),
          action_reason: reason,
          created_at: new Date().toISOString(),
          target_user_id: userId
        })
        .select()
        .single();
  
      if (actionError) {
        console.error("Supabase insert error for action_taken_by:", actionError);
        res.status(500).json({
          success: false,
          message: `Failed to log action: ${actionError.message}`,
        });
        return;
      }
  
      console.log("Action taken by data inserted:", actionData);
  
      // Update user table with new status, user_role, and action_by
      const updateData = {
        acc_status: userData.acc_status,
        user_role: userData.user_role,
        action_by: parseInt(loggedInUserId),
        verified: userData.acc_status === "Active" ? true : false
      };
  
      const updatedUser = await AuthorityAccount.update(userId, {
        ...updateData,
        first_name: userData.first_name,
        middle_name: userData.middle_name,
        last_name: userData.last_name,
        birthdate: userData.birthday,
        email: userData.email,
        contact: userData.contact || "", 
        gender: userData.gender || ""  
      });
  
      if (userData.acc_status === "Active" && userData.user_role === "Tasker") {
        await AuthorityAccount.updateTaskerDocumentsValid(userId.toString(), true);
      }
  
      res.status(200).json({
        success: true,
        message: "User status updated successfully",
        user: updatedUser
      });
    } catch (error) {
      console.error("Error in updateUserStatus:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while updating the user status",
        error: error instanceof Error ? error.message : "Unknown error",
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
      console.log("User Document (including face_image):", userDocs); 
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

      // Fetch the file from Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(fileName);

      if (error) {
        if (error.message.includes("404")) {
          return res.status(404).json({ error: "File not found in Supabase Storage" });
        }
        throw new Error(`Failed to fetch the document from Supabase Storage: ${error.message}`);
      }

      const buffer = Buffer.from(await data.arrayBuffer());

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=\"document.pdf\"");
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
      // Create HTML email template
      const htmlTemplate = `
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

    <p class="greeting">Hi there!</p>
    <p class="body-text">We received a request to reset the password for your account. Please use the One-Time Password (OTP) below to proceed:</p>
    <p class="otp">Your OTP Code: <span class="code">${otp}</span></p>
    <p class="body-text last">This code is valid for the next 10 minutes. If you didn’t request a password reset, you can safely ignore this email.</p>

    <p class="closing">Thank you,<br>The QTask Team</p>

    <div class="footer">
      <img src="https://tzdthgosmoqepbypqbbu.supabase.co/storage/v1/object/public/email-template-images//Quanby.png" alt="Quanby">
      <span>From Quanby Solutions Inc</span>
    </div>
  </div>
</body>
</html>
      `;

      // Send OTP via email using the existing mailer configuration
      await mailer.sendMail({
        from: process.env.MAIL_USERNAME,
        to: email,
        subject: "Your OTP for Password Reset",
        html: htmlTemplate,
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

      // Clear the otp code after successfull verification
      const { error: updateError } = await supabase
        .from("two_fa_code")
        .update({
          two_fa_code: null
        })
        .eq("code_id", otpRecord.code_id);

      if (updateError) {
        throw new Error(updateError.message);
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

      // Clear the two_fa_code attribute instead of deleting the record
      await supabase.from("two_fa_code").update({ two_fa_code: null }).eq("user_id", user.user_id);

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

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      console.log('Fetching all users...');
      // First get all users
      const { data: users, error: usersError } = await supabase
        .from('user')
        .select('*')
        .order("created_at", { ascending: false });

      if (usersError) {
        console.error("Error fetching users:", usersError);
        res.status(500).json({ error: usersError.message });
        return;
      }
      console.log('Fetched users:', users.length);

      // Get all users who are referenced in action_by
      const actionByUserIds = users
        .filter(user => user.action_by)
        .map(user => user.action_by);

      console.log('Action by user IDs:', actionByUserIds);

      let actionByUsersMap = new Map();
      if (actionByUserIds.length > 0) {
        console.log('Fetching action_by user details...');
        const { data: actionByUsers, error: actionByUsersError } = await supabase
          .from('user')
          .select('user_id, first_name, middle_name, last_name')
          .in('user_id', actionByUserIds);

        if (actionByUsersError) {
          console.error("Error fetching action_by users:", actionByUsersError);
          res.status(500).json({ error: actionByUsersError.message });
          return;
        }
        console.log('Fetched action_by users:', actionByUsers.length);

        // Create a map of user_id to user details for quick lookup
        actionByUsersMap = new Map(
          actionByUsers.map(user => [user.user_id, user])
        );
        console.log('Created actionByUsersMap');
      }

      console.log('Fetching all action_taken_by records...');
      // Get all actions taken by users
      const { data: actions, error: actionsError } = await supabase
        .from('action_taken_by')
        .select('*')
        .order("created_at", { ascending: false });

      if (actionsError) {
        console.error("Error fetching actions:", actionsError);
        res.status(500).json({ error: actionsError.message });
        return;
      }
      console.log('Fetched action_taken_by records:', actions.length);


      // Transform the data to include the full name of action_by user and action_reason
      const transformedData = users.map(user => {
        const actionByUser = user.action_by ? actionByUsersMap.get(user.action_by) : null;

        // Find the latest action taken ON this user (target_user_id) by the action_by user (user_id)
        const userActions = actions.filter(action => 
          action.target_user_id === user.user_id && 
          action.user_id === user.action_by // Filter by the user who took the action
        );

        const latestAction = userActions.length > 0
          ? userActions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;

        console.log(`Processing user ${user.user_id}: Found ${userActions.length} actions, latestAction:`, latestAction);

        return {
          ...user,
          action_by_name: actionByUser ? 
            `${actionByUser.first_name} ${actionByUser.middle_name || ''} ${actionByUser.last_name}`.trim() : 
            'No Action Yet',
          action_reason: latestAction?.action_reason || 'Empty' // Add the action reason
        };
      });

      console.log('Transformed data:', transformedData);
      res.status(200).json({ users: transformedData });
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

}

export default AuthorityAccountController;