import { mailer, supabase } from "../config/configuration";
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
import taskerModel from "../models/taskerModel";
import { Auth } from "../models/authenticationModel";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import crypto from "crypto";

class UserAccountController {
  static async registerUser(req: Request, res: Response): Promise<any> {
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
      } = req.body;
      const imageFile = req.file;
      console.log("Received insert account data:", req.body);

      // Check if the email exists
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
        birthdate: birthday, // Map 'birthday' to 'birthdate' in the table
        email,
        user_role,
        image_link: imageUrl,
      };

      if (password) {
        // Regular registration
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = randomUUID();
        userData.hashed_password = hashedPassword;
        userData.acc_status = 'Pending';
        userData.verification_token = verificationToken;
        userData.emailVerified = false;

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}&email=${email}`;
        console.log(verificationLink);

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Verify your email for NearbyTask',
          html: `
            <h1>Welcome to NearbyTask!</h1>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify Email</a>
            <p>If you didn't create an account, please ignore this email.</p>
          `
        });
      } else {
        // Admin addition via /userAdd
        userData.hashed_password = null;
        userData.acc_status = acc_status;
        userData.emailVerified = true;
        userData.verification_token = null;
      }

      const { data: newUser, error: insertError } = await supabase
        .from("user")
        .insert([userData])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Insert into clients table only if user_role is 'Client'
      if (user_role === 'Client') {
        const { error: clientInsertError } = await supabase
          .from("clients")
          .insert([
            {
              user_id: newUser.user_id,
              preferences: '',
              client_address: '',
            },
          ]);

        if (clientInsertError) {
          throw new Error(clientInsertError.message);
        }
      }

      res.status(201).json({
        message: password ? "Registration successful! Please check your email to verify your account." : "User added successfully.",
        user: {
          id: newUser.user_id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        errors: error instanceof Error ? error.message : "An error occurred during registration"
      });
    }
  }

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token, email } = req.body;

      const { data: user, error } = await supabase
        .from("user")
        .select("*")
        .eq("email", email)
        .eq("verification_token", token)
        .single();

      if (error || !user) {
        res.status(400).json({ error: "Invalid verification token" });
        return;
      }

      const { error: updateError } = await supabase
        .from("user")
        .update({ 
          acc_status: "Review",
          verification_token: null,
          emailVerified: true
        })
        .eq("user_id", user.user_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Create session
      req.session.userId = user.user_id;
      
      res.status(200).json({ 
        message: "Email verified successfully",
        user_id: user.user_id,
        session: req.session
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "An error occurred during email verification"
      });
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.id;

      const { data, error } = await supabase
        .from("user")
        .delete()
        .eq("user_id", userID);

      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ users: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getUserDocs(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.id;
      console.log("Retrieving User Document for..." + userID);
      const userDocs = await UserAccount.getUserDocs(userID);
      console.log("User Document: " + userDocs);
      res.status(200).json({ user: userDocs });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getUserData(req: Request, res: Response): Promise<any> {
    console.log("Request: ", req.body);
    try {
      const userID = req.params.id;
      console.log("Retrieving User Data for..." + userID);

      const userData = await UserAccount.showUser(userID);
      if (userData.user_role === "Client") {
        const clientData = await UserAccount.showClient(userID);
        res.status(200).json({ user: userData, client: clientData });
        console.log("Client Data: " + clientData);
      } else if (userData.user_role === "Tasker") {
        const taskerData = await UserAccount.showTasker(userID);
        console.log("Tasker Data: " + taskerData);
        res.status(200).json({ user: userData, tasker: taskerData.tasker, taskerDocument: taskerData.taskerDocument });
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

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase.from("user").select();

      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ users: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        acc_status,
      } = req.body;
      const imageFile = req.file;

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError && findError.message) {
        return res.status(500).json({ error: findError.message });
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      let imageUrl = "";
      if (imageFile) {
        const fileName = `users/${Date.now()}_${imageFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, imageFile.buffer, {
            cacheControl: "3600",
            upsert: false,
          });

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        imageUrl = publicUrlData?.publicUrl || "";
      }

      const updateData: Record<string, any> = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        acc_status
      };

      if (imageUrl) {
        updateData.image_link = imageUrl;
      }

      const { error: updateError } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId);

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.status(200).json({ message: "User updated successfully", user: updateData });

    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async updateTaskerWithPDF(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name, middle_name, last_name, email, user_role, contact, gender, birthdate,
        specialization_id, bio, skills, wage_per_hour, pay_period
      } = req.body;

      console.log("Received Data:", req.body);

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError) {
        console.error("Error checking email existence:", findError);
        return res.status(500).json({ error: findError.message });
      }
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      let pdfUrl: string | null = null;

      if (files && files.file && files.file.length > 0) {
        const pdfFile = files.file[0];
        const fileName = `users/pdf_${userId}_${Date.now()}_${pdfFile.originalname}.pdf`;

        console.log("Uploading PDF File:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, new Blob([pdfFile.buffer]), {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading PDF: ${error.message}` });
        }

        pdfUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
      }

      console.log("PDF Document URL:", pdfUrl);

      const updateUser = {
        first_name, middle_name, last_name, email, user_role, contact,
        gender, birthdate, 
      };

      const updateSkills = { specialization_id, bio, skills, wage_per_hour, pay_period, updated_at: new Date() };

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      const { error: updateSkillsError } = await supabase
        .from("tasker")
        .update(updateSkills)
        .eq("user_id", userId);

      if (updateSkillsError) {
        console.error("Error updating tasker table:", updateSkillsError);
        return res.status(500).json({ error: updateSkillsError.message });
      }

      const { data: existingDocument } = await supabase
        .from("tasker_documents")
        .select("tasker_id")
        .eq("tasker_id", userId)
        .maybeSingle();

      if (existingDocument) {
        const { error: pdfUpdateError } = await supabase
          .from("tasker_documents")
          .update({
            tesda_document_link: pdfUrl,
            valid: false,
            updated_at: new Date()
          })
          .eq("tasker_id", userId);

        if (pdfUpdateError) {
          console.error("Error updating tasker_documents table:", pdfUpdateError);
          return res.status(500).json({ error: pdfUpdateError.message });
        }
      } else {
        const { error: insertError } = await supabase
          .from("tasker_documents")
          .insert({
            tasker_id: userId,
            tesda_document_link: pdfUrl,
            valid: false,
            created_at: new Date(),
            updated_at: new Date()
          });

        if (insertError) {
          console.error("Error inserting into tasker_documents table:", insertError);
          return res.status(500).json({ error: insertError.message });
        }
      }

      return res.status(200).json({
        message: "User updated successfully",
        pdfUrl,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async updateTaskerWithFileandImage(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name, middle_name, last_name, email, user_role, contact, gender, birthdate,
        specialization_id, bio, skills, wage_per_hour, pay_period
      } = req.body;

      console.log("Received Data:", req.body);

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError) {
        console.error("Error checking email existence:", findError);
        return res.status(500).json({ error: findError.message });
      }
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      let pdfUrl: string | null = null;
      let profileImageUrl: string | null = null;

      if (files && files.file && files.file.length > 0) {
        const pdfFile = files.file[0];
        const fileName = `users/pdf_${userId}_${Date.now()}_${pdfFile.originalname}.pdf`;

        console.log("Uploading PDF File:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, new Blob([pdfFile.buffer]), {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading PDF: ${error.message}` });
        }

        pdfUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
      }

      if (files && files.image && files.image.length > 0) {
        const profileImageFile = files.image[0];
        const fileName = `users/profile_${userId}_${Date.now()}_${profileImageFile.originalname}`;

        console.log("Uploading Profile Image:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, new Blob([profileImageFile.buffer]), {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading profile image: ${error.message}` });
        }

        profileImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
      }

      console.log("Profile Image URL:", profileImageUrl);
      console.log("PDF Document URL:", pdfUrl);

      const updateUser = {
        first_name, middle_name, last_name, email, user_role, contact,
        gender, birthdate, image_link: profileImageUrl
      };

      const updateSkills = { specialization_id, bio, skills, wage_per_hour, pay_period, updated_at: new Date() };

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      const { error: updateSkillsError } = await supabase
        .from("tasker")
        .update(updateSkills)
        .eq("user_id", userId);

      if (updateSkillsError) {
        console.error("Error updating tasker table:", updateSkillsError);
        return res.status(500).json({ error: updateSkillsError.message });
      }

      const { data: existingDocument } = await supabase
        .from("tasker_documents")
        .select("tasker_id")
        .eq("tasker_id", userId)
        .maybeSingle();

      if (existingDocument) {
        const { error: pdfUpdateError } = await supabase
          .from("tasker_documents")
          .update({
            tesda_document_link: pdfUrl,
            valid: false,
            updated_at: new Date()
          })
          .eq("tasker_id", userId);

        if (pdfUpdateError) {
          console.error("Error updating tasker_documents table:", pdfUpdateError);
          return res.status(500).json({ error: pdfUpdateError.message });
        }
      } else {
        const { error: insertError } = await supabase
          .from("tasker_documents")
          .insert({
            tasker_id: userId,
            tesda_document_link: pdfUrl,
            valid: false,
            created_at: new Date(),
            updated_at: new Date()
          });

        if (insertError) {
          console.error("Error inserting into tasker_documents table:", insertError);
          return res.status(500).json({ error: insertError.message });
        }
      }

      return res.status(200).json({
        message: "User updated successfully",
        profileImageUrl,
        pdfUrl,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async updateTaskerWithProfileImage(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name, middle_name, last_name, email, user_role, contact, gender, birthdate,
        specialization_id, bio, skills, wage_per_hour, pay_period
      } = req.body;

      console.log("Received Data:", req.body);

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError) {
        console.error("Error checking email existence:", findError);
        return res.status(500).json({ error: findError.message });
      }
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let profileImageUrl: string | null = null;

      if (files?.image?.[0]) {
        const imageFile = files.image[0];
        const fileName = `users/profile_${userId}_${Date.now()}_${imageFile.originalname}`;

        console.log("Uploading Profile Image:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, new Blob([imageFile.buffer]), {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading profile image: ${error.message}` });
        }

        profileImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
      }

      console.log("Profile Image URL:", profileImageUrl);

      const updateUser = {
        first_name, middle_name, last_name, email, user_role, contact,
        gender, birthdate, image_link: profileImageUrl
      };

      const updateSkills = { specialization_id, bio, skills, wage_per_hour, pay_period, updated_at: new Date() };

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      const { error: updateSkillsError } = await supabase
        .from("tasker")
        .update(updateSkills)
        .eq("user_id", userId);

      if (updateSkillsError) {
        console.error("Error updating tasker table:", updateSkillsError);
        return res.status(500).json({ error: updateSkillsError.message });
      }

      return res.status(200).json({
        message: "User updated successfully",
        profileImageUrl,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async updateUserWithImages(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
      } = req.body;

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError && findError.message) {
        return res.status(500).json({ error: findError.message });
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let profileImageUrl = "";
      let idImageUrl = "";

      if (files && files.profileImage && files.profileImage.length > 0) {
        const profileImageFile = files.profileImage[0];
        const fileName = `users/profile_${userId}_${Date.now()}_${profileImageFile.originalname}`;
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, profileImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading profile image: ${error.message}` });
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        profileImageUrl = publicUrlData?.publicUrl || "";
      }

      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `users/id_${userId}_${Date.now()}_${idImageFile.originalname}`;

        console.log("ID Image File:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, idImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading ID image: ${error.message}` });
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        idImageUrl = publicUrlData?.publicUrl || "";
      }

      console.log("Profile Image URL:", profileImageUrl);
      console.log("ID Image URL:", idImageUrl);
      
      const updateData: Record<string, any> = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
      };

      console.log("Update Data:", updateData);

      if (profileImageUrl) {
        updateData.image_link = profileImageUrl;
      }

      const { data, error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (idImageUrl) {
        const { data: existingIdImage, error: idCheckError } = await supabase
          .from("client_documents")
          .select("*")
          .eq("user_id", userId)
          .eq("document_type", "id")
          .maybeSingle();

        if (idCheckError) {
          console.error("Error checking for existing ID image:", idCheckError);
        }

        if (existingIdImage) {
          const { error: updateIdError } = await supabase
            .from("client_documents")
            .update({
              document_url: idImageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingIdImage.id);

          if (updateIdError) {
            console.error("Error updating ID image record:", updateIdError);
          }
        } else {
          const { error: insertIdError } = await supabase
            .from("client_documents")
            .insert({
              user_id: userId,
              document_type: "id",
              document_url: idImageUrl,
              created_at: new Date().toISOString(),
            });

          if (insertIdError) {
            console.error("Error creating ID image record:", insertIdError);
          }
        }
      }

      return res.status(200).json({
        message: "User updated successfully",
        user: data,
        profileImage: profileImageUrl || null,
        idImage: idImageUrl || null,
      });
    } catch (error: any) {
      console.error("Error in updateUserWithImages:", error);
      return res.status(500).json({ error: error.message || "An error occurred while updating user" });
    }
  }

  static async updateUserWithProfileImage(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        acc_status, 
      } = req.body;

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError && findError.message) {
        return res.status(500).json({ error: findError.message });
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let profileImageUrl = "";

      if (files && files.profileImage && files.profileImage.length > 0) {
        const profileImageFile = files.profileImage[0];
        const fileName = `users/profile_${userId}_${Date.now()}_${profileImageFile.originalname}`;
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, profileImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading profile image: ${error.message}` });
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        profileImageUrl = publicUrlData?.publicUrl || "";
      }

      console.log("Profile Image URL:", profileImageUrl);
      
      const updateData: Record<string, any> = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        acc_status, // Added acc_status to the updateData object
      };

      console.log("Update Data:", updateData);

      if (profileImageUrl) {
        updateData.image_link = profileImageUrl;
      }

      const { data, error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        message: "User updated successfully",
        user: data,
        profileImage: profileImageUrl || null,
      });
    } catch (error: any) {
      console.error("Error in updateUserWithProfileImage:", error);
      return res.status(500).json({ error: error.message || "An error occurred while updating user" });
    }
  }

  static async updateUserWithIdImage(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
      } = req.body;

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (findError && findError.message) {
        return res.status(500).json({ error: findError.message });
      }

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let idImageUrl = "";

      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `users/id_${userId}_${Date.now()}_${idImageFile.originalname}`;

        console.log("ID Image File:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, idImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res.status(500).json({ error: `Error uploading ID image: ${error.message}` });
        }

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName);

        idImageUrl = publicUrlData?.publicUrl || "";
      }

      console.log("ID Image URL:", idImageUrl);
      
      const updateData: Record<string, any> = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
      };

      console.log("Update Data:", updateData);

      const { data, error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      if (idImageUrl) {
        const { data: existingIdImage, error: idCheckError } = await supabase
          .from("client_documents")
          .select("*")
          .eq("user_id", userId)
          .eq("document_type", "id")
          .maybeSingle();

        if (idCheckError) {
          console.error("Error checking for existing ID image:", idCheckError);
        }

        if (existingIdImage) {
          const { error: updateIdError } = await supabase
            .from("client_documents")
            .update({
              document_url: idImageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingIdImage.id);

          if (updateIdError) {
            console.error("Error updating ID image record:", updateIdError);
          }
        } else {
          const { error: insertIdError } = await supabase
            .from("client_documents")
            .insert({
              user_id: userId,
              document_type: "id",
              document_url: idImageUrl,
              created_at: new Date().toISOString(),
            });

          if (insertIdError) {
            console.error("Error creating ID image record:", insertIdError);
          }
        }
      }

      return res.status(200).json({
        message: "User updated successfully",
        user: data,
        idImage: idImageUrl || null,
      });
    } catch (error: any) {
      console.error("Error in updateUserWithImages:", error);
      return res.status(500).json({ error: error.message || "An error occurred while updating user" });
    }
  }

  static async getPaginationUsers(req: Request, res: Response): Promise<any> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      const { data: users, error } = await supabase
        .from("user")
        .select("*")
        .order("created_at")
        .range(start, end);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.json({
        users,
        total: users,
        page,
        pageSize,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown server error",
      });
    }
  }
}

export default UserAccountController;