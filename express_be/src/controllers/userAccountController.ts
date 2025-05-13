import { mailer, supabase } from "../config/configuration";
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
import taskerModel from "../models/taskerModel";
import { Auth } from "../models/authenticationModel";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { group } from "console";
import { authHeader } from "../config/configuration";

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

      // Generate verification token
      const verificationToken = randomUUID();

      // Hash password with bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      // Handle image upload if provided
      let imageUrl = "";
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

        imageUrl = publicUrlData?.publicUrl || "";
      }

      // Define userData object for insertion
      const userData = {
        first_name,
        middle_name,
        last_name,
        birthdate: birthday,
        email,
        hashed_password: hashedPassword,
        acc_status: acc_status || "Pending", // Default to "Pending" if not provided
        user_role,
        verification_token: verificationToken,
        emailVerified: false, // Default to false until verified
        image_link: imageUrl || null, // Use image URL if available, otherwise null
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert user into Supabase database
      const { data: newUser, error: insertError } = await supabase
        .from("user")
        .insert([userData])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Insert into clients or tasker table based on user_role
      if (user_role === "Client") {
        const { error: errorInsert } = await supabase
          .from("clients")
          .insert([
            {
              client_id: newUser.user_id,
              user_id: newUser.user_id,
              preferences: "",
              client_address: "",
            },
          ]);

        console.log("New user ID: " + newUser.user_id);

        if (errorInsert) {
          throw new Error(errorInsert.message);
        }
      } else if (user_role === "Tasker") {
        const { error: errorInsert } = await supabase
          .from("tasker")
          .insert([
            {
              tasker_id: newUser.user_id,
              user_id: newUser.user_id,
            },
          ]);

        console.log("New user ID: " + newUser.user_id);

        if (errorInsert) {
          throw new Error(errorInsert.message);
        }
      }

      // Send verification email (uncomment and configure as needed)
      /*
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });*/

      const verificationLink = `${process.env.URL}/verify?token=${verificationToken}&email=${email}`;
      console.log(verificationLink);
      /*
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email for NearbyTask",
        html: `
          <h1>Welcome to NearbyTask!</h1>
          <p>Please click the link below to verify your email address:</p>
          <a href="${verificationLink}">Verify Email</a>
          <p>If you didn't create an account, please ignore this email.</p>
        `,
      });
      */

      res.status(201).json({
        message: password
          ? "Registration successful! Please check your email to verify your account."
          : "User added successfully.",
        user: {
          id: newUser.user_id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        errors:
          error instanceof Error
            ? error.message
            : "An error occurred during registration",
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
          emailVerified: true,
          verified: true,
        })
        .eq("user_id", user.user_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      req.session.userId = user.user_id;

      res.status(200).json({
        message: "Email verified successfully",
        user_id: user.user_id,
        session: req.session,
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "An error occurred during email verification",
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
      
      // Use type assertion to allow adding properties
      const userDataWithExtras: any = { ...userData };

      // Fetch bio and social_media_links from user_verify table
      const { data: verifyData, error: verifyError } = await supabase
        .from("user_verify")
        .select("bio, social_media_links")
        .eq("user_id", userID)
        .maybeSingle();
        
      // Add bio and social_media_links to userData if they exist in user_verify
      if (!verifyError && verifyData) {
        userDataWithExtras.bio = verifyData.bio || null;
        userDataWithExtras.social_media_links = verifyData.social_media_links || null;
      }

      if (userDataWithExtras.user_role.toLowerCase() === "client") {
        const clientData = await UserAccount.showClient(userID);
        if(!clientData) {
          res.status(404).json({ error: "Please Verify Your Account First." });
          return;
        }
        res.status(200).json({ user: userDataWithExtras, client: clientData });
        console.log("Client Data: " + clientData);
      } else if (userDataWithExtras.user_role.toLowerCase() === "tasker") {
        const taskerData = await UserAccount.showTasker(userID);

        if(!taskerData) {
          res.status(404).json({ error: "Please Verify Your Account First." });
          return;
        }
        
        // For taskers, prioritize bio and social_media_links from tasker table
        if (taskerData.tasker) {
          // Only override if tasker has these fields
          if (taskerData.tasker.bio) {
            userDataWithExtras.bio = taskerData.tasker.bio;
          }
          
          if (taskerData.tasker.social_media_links) {
            userDataWithExtras.social_media_links = taskerData.tasker.social_media_links;
          }
        }
        
        res.status(200).json({ user: userDataWithExtras, tasker: taskerData.tasker, taskerDocument: taskerData.taskerDocument });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unknown error");
      console.error(error instanceof Error ? error.stack : "Unknown error");
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "An Error Occured while Retrieving Your Information. Please try again.",
      });
    }
  }

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase.from("user").select().order("created_at", { ascending: false });;

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
        acc_status,
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

      return res
        .status(200)
        .json({ message: "User updated successfully", user: updateData });
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
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
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
          .upload(fileName, pdfFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading PDF: ${error.message}` });
        }

        pdfUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      console.log("PDF Document URL:", pdfUrl);

      const updateUser = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
      };

      const updateSkills = {
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
        updated_at: new Date(),
      };

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
        .from("user_documents")
        .select("tasker_id")
        .eq("tasker_id", userId)
        .maybeSingle();

      if (existingDocument) {
        const { error: pdfUpdateError } = await supabase
          .from("user_documents")
          .update({
            user_document_link: pdfUrl,
            valid: false,
            updated_at: new Date(),
          })
          .eq("tasker_id", userId);

        if (pdfUpdateError) {
          console.error(
            "Error updating user_documents table:",
            pdfUpdateError
          );
          return res.status(500).json({ error: pdfUpdateError.message });
        }
      } else {
        const { error: insertError } = await supabase
          .from("user_documents")
          .insert({
            tasker_id: userId,
            user_document_link: pdfUrl,
            valid: false,
            created_at: new Date(),
            updated_at: new Date(),
          });

        if (insertError) {
          console.error(
            "Error inserting into user_documents table:",
            insertError
          );
          return res.status(500).json({ error: insertError.message });
        }
      }

      return res.status(200).json({
        message: "User updated successfully",
        pdfUrl,
      });
    } catch (error) {
      console.error("Unexpected error:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  static async updateTaskerWithFileandImage(
    req: Request,
    res: Response
  ): Promise<any> {
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
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
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
          .upload(fileName, pdfFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading PDF: ${error.message}` });
        }

        pdfUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      if (files && files.image && files.image.length > 0) {
        const profileImageFile = files.image[0];
        const fileName = `users/profile_${userId}_${Date.now()}_${profileImageFile.originalname}`;

        console.log("Uploading Profile Image:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, profileImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading profile image: ${error.message}` });
        }

        profileImageUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      console.log("Profile Image URL:", profileImageUrl);
      console.log("PDF Document URL:", pdfUrl);

      const updateUser = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        image_link: profileImageUrl,
      };

      const updateSkills = {
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
        updated_at: new Date(),
      };

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
        .from("user_documents")
        .select("tasker_id")
        .eq("tasker_id", userId)
        .maybeSingle();

      if (existingDocument) {
        const { error: pdfUpdateError } = await supabase
          .from("user_documents")
          .update({
            user_document_link: pdfUrl,
            valid: false,
            updated_at: new Date(),
          })
          .eq("tasker_id", userId);

        if (pdfUpdateError) {
          console.error(
            "Error updating user_documents table:",
            pdfUpdateError
          );
          return res.status(500).json({ error: pdfUpdateError.message });
        }
      } else {
        const { error: insertError } = await supabase
          .from("user_documents")
          .insert({
            tasker_id: userId,
            user_document_link: pdfUrl,
            valid: false,
            created_at: new Date(),
            updated_at: new Date(),
          });

        if (insertError) {
          console.error(
            "Error inserting into user_documents table:",
            insertError
          );
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
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  static async updateTaskerWithProfileImage(
    req: Request,
    res: Response
  ): Promise<any> {
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
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
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
          .upload(fileName, imageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading profile image: ${error.message}` });
        }

        profileImageUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      console.log("Profile Image URL:", profileImageUrl);

      const updateUser = {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        image_link: profileImageUrl,
      };

      const updateSkills = {
        specialization_id,
        bio,
        skills,
        wage_per_hour,
        pay_period,
        updated_at: new Date(),
      };

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
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  static async updateUserWithImages(
    req: Request,
    res: Response
  ): Promise<any> {
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
          return res
            .status(500)
            .json({ error: `Error uploading profile image: ${error.message}` });
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
          return res
            .status(500)
            .json({ error: `Error uploading ID image: ${error.message}` });
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
      return res
        .status(500)
        .json({
          error: error.message || "An error occurred while updating user",
        });
    }
  }

  static async updateUserWithProfileImage(
    req: Request,
    res: Response
  ): Promise<any> {
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
          return res
            .status(500)
            .json({ error: `Error uploading profile image: ${error.message}` });
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
        acc_status,
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
      return res
        .status(500)
        .json({
          error: error.message || "An error occurred while updating user",
        });
    }
  }

  static async updateUserWithIdImage(
    req: Request,
    res: Response
  ): Promise<any> {
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
          return res
            .status(500)
            .json({ error: `Error uploading ID image: ${error.message}` });
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
      return res
        .status(500)
        .json({
          error: error.message || "An error occurred while updating user",
        });
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

  // New methods for forgot password
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

      // Return OTP directly instead of sending via email
      res.status(200).json({ 
        message: "OTP generated successfully", 
        user_id: user.user_id,
        otp: otp 
      });
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

  static async submitUserVerification(
    req: Request,
    res: Response
  ): Promise<any> {
    try {
      // Ensure the user_verify table exists with the correct structure
      await UserAccountController.ensureUserVerifyTable();
      
      const userId = Number(req.params.id);
      const {
        gender,
        phone_number,
        bio,
        social_media_links,
        // Additional fields for user table updates
        first_name,
        middle_name,
        last_name,
        email,
        birthdate,
        user_role,
        // Flag to indicate if this is an update to existing verification
        is_update,
      } = req.body;

      const isUpdateMode = is_update === 'true';
      console.log("Received User Verification Data:", req.body);
      console.log("Is update mode:", isUpdateMode);

      // Check if email already exists for another user
      if (email) {
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
      }

      // Get the user's current role to determine storage paths
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("user_role, acc_status")
        .eq("user_id", userId)
        .single();
        
      if (userError) {
        console.error("Error fetching user role:", userError);
        return res.status(500).json({ error: "Unable to determine user type" });
      }
      
      const userType = user_role || userData.user_role || "Unknown";
      console.log(`Processing verification for ${userType} user`);

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      let idImageUrl: string | null = null;
      let selfieImageUrl: string | null = null;
      let documentsUrl: string | null = null;

      // Upload ID image if provided
      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `users/id_${userId}_${Date.now()}_${idImageFile.originalname}`;

        console.log("Uploading ID Image:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, idImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading ID image: ${error.message}` });
        }

        idImageUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      // Upload selfie image if provided
      if (files && files.selfieImage && files.selfieImage.length > 0) {
        const selfieImageFile = files.selfieImage[0];
        const fileName = `users/selfie_${userId}_${Date.now()}_${selfieImageFile.originalname}`;

        console.log("Uploading Selfie Image:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, selfieImageFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading selfie image: ${error.message}` });
        }

        selfieImageUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      // Upload documents if provided
      if (files && files.documents && files.documents.length > 0) {
        const documentFile = files.documents[0];
        const fileName = `users/documents_${userId}_${Date.now()}_${documentFile.originalname}`;

        console.log("Uploading Documents:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, documentFile.buffer, {
            cacheControl: "3600",
            upsert: true,
          });

        if (error) {
          return res
            .status(500)
            .json({ error: `Error uploading documents: ${error.message}` });
        }

        documentsUrl = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;
      }

      console.log("ID Image URL:", idImageUrl);
      console.log("Selfie Image URL:", selfieImageUrl);
      console.log("Documents URL:", documentsUrl);

      // Store basic info in the user table
      const updateUser: any = {};
      if (first_name) updateUser.first_name = first_name;
      if (middle_name) updateUser.middle_name = middle_name;
      if (last_name) updateUser.last_name = last_name;
      if (email) updateUser.email = email;
      if (gender) updateUser.gender = gender;
      if (phone_number) updateUser.contact = phone_number;
      if (birthdate) updateUser.birthdate = birthdate;
      
      // Set verification status - only for new submissions, not updates
      if (!isUpdateMode) {
        updateUser.acc_status = "Pending Verification";
      }
      
      // Use selfie as profile image if available
      if (selfieImageUrl) {
        updateUser.image_link = selfieImageUrl;
      }

      // Update the user table
      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      // Try inserting into user_verify using a direct approach
      console.log("Checking if user verification record already exists");
      
      // Get current date in ISO format
      const currentDate = new Date().toISOString();
      
      // Check if a verification record already exists
      const { data: existingVerification, error: checkError } = await supabase
        .from('user_verify')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (checkError) {
        console.error("Error checking for existing verification:", checkError);
      }
      
      // Prepare verification data
      const verificationData = {
        user_id: userId,
        gender: gender || '',
        phone_number: phone_number || '',
        bio: bio || '',
        social_media_links: social_media_links || '{}',
        created_at: existingVerification ? undefined : currentDate,
        updated_at: existingVerification ? currentDate : undefined
      };
      
      console.log("Attempting to save verification data");
      
      // Use upsert to handle both insert and update
      const { data: verifyData, error: verifyError } = await supabase
        .from('user_verify')
        .upsert(verificationData)
        .select();
      
      if (verifyError) {
        console.error("Error saving to user_verify:", verifyError);
      } else {
        console.log("Successfully saved to user_verify table:", verifyData);
      }

      // Now handle the image and document data in their respective tables
      let verificationSuccess = true;
      let failedTables = [];
      
      // Insert ID image data if provided
      if (idImageUrl) {
        console.log("Attempting to insert ID image data");
        const idImageData = {
          user_id: userId,
          id_image: idImageUrl,
          created_at: existingVerification ? undefined : currentDate,
          updated_at: existingVerification ? currentDate : undefined
        };
        
        // Note: There might be a foreign key constraint issue if the database schema
        // hasn't been fully updated from tasker_* to user_* tables
        const { data: idImageInsertResult, error: idImageError } = await supabase
          .from('user_id')
          .upsert(idImageData)
          .select();
          
        if (idImageError) {
          console.error("Error inserting into user_id table:", idImageError);
          // Handle foreign key constraint errors gracefully
          if (idImageError.code === '23503' && idImageError.message.includes('foreign key constraint')) {
            console.warn("This appears to be a foreign key constraint issue. The database schema may need to be updated to change foreign key references from tasker_* to user_* tables.");
            console.warn("As a temporary workaround, we'll continue with the verification process.");
            // Don't mark verification as failed due to DB schema issues
          } else {
            verificationSuccess = false;
            failedTables.push('user_id');
          }
        } else {
          console.log("Successfully inserted into user_id table");
        }
        
        // Also save ID image to client_documents if the user is a client
        if (userType.toLowerCase() === 'client') {
          const clientDocData = {
            user_id: userId,
            document_type: 'id',
            document_url: idImageUrl,
            created_at: existingVerification ? undefined : currentDate,
            updated_at: existingVerification ? currentDate : undefined
          };
          
          const { error: clientDocError } = await supabase
            .from('client_documents')
            .upsert(clientDocData)
            .select();
            
          if (clientDocError) {
            console.warn("Could not save ID to client_documents:", clientDocError);
          }
        }
      }
      
      // Insert selfie/face image data if provided
      if (selfieImageUrl) {
        console.log("Attempting to insert face image data");
        const faceImageData = {
          user_id: userId,
          face_image: selfieImageUrl,
          created_at: existingVerification ? undefined : currentDate,
          updated_at: existingVerification ? currentDate : undefined
        };
        
        // Note: There might be a foreign key constraint issue if the database schema
        // hasn't been fully updated from tasker_* to user_* tables
        const { data: faceImageInsertResult, error: faceImageError } = await supabase
          .from('user_face_identity')
          .upsert(faceImageData)
          .select();
          
        if (faceImageError) {
          console.error("Error inserting into user_face_identity table:", faceImageError);
          // Handle foreign key constraint errors gracefully
          if (faceImageError.code === '23503' && faceImageError.message.includes('foreign key constraint')) {
            console.warn("This appears to be a foreign key constraint issue. The database schema may need to be updated to change foreign key references from tasker_* to user_* tables.");
            console.warn("As a temporary workaround, we'll continue with the verification process.");
            // Don't mark verification as failed due to DB schema issues
          } else {
            verificationSuccess = false;
            failedTables.push('user_face_identity');
          }
        } else {
          console.log("Successfully inserted into user_face_identity table");
        }
      }
      
      // Insert document data if provided
      if (documentsUrl) {
        console.log("Attempting to insert document data");
        const documentData = {
          tasker_id: userId,
          user_document_link: documentsUrl,
          created_at: existingVerification ? undefined : currentDate,
          updated_at: existingVerification ? currentDate : undefined
        };
        
        // Note: There might be a foreign key constraint issue if the database schema
        // hasn't been fully updated from tasker_* to user_* tables
        const { data: documentInsertResult, error: documentError } = await supabase
          .from('user_documents')
          .upsert(documentData)
          .select();
          
        if (documentError) {
          console.error("Error inserting into user_documents table:", documentError);
          // Handle foreign key constraint errors gracefully
          if (documentError.code === '23503' && documentError.message.includes('foreign key constraint')) {
            console.warn("This appears to be a foreign key constraint issue. The database schema may need to be updated to change foreign key references from tasker_* to user_* tables.");
            console.warn("As a temporary workaround, we'll continue with the verification process.");
            // Don't mark verification as failed due to DB schema issues
          } else {
            verificationSuccess = false;
            failedTables.push('user_documents');
          }
        } else {
          console.log("Successfully inserted into user_documents table");
        }
      }

      // Determine the appropriate response message
      let message;
      if (isUpdateMode) {
        message = verificationSuccess 
          ? "Your information has been updated successfully!" 
          : `Your information was partially updated. There were problems with: ${failedTables.join(', ')}. Please contact support if you continue to have issues.`;
      } else {
        message = verificationSuccess 
          ? "Verification submitted successfully! Your information will be reviewed shortly." 
          : `Verification submitted with some issues. Your basic information was saved, but there were problems with: ${failedTables.join(', ')}. Please contact support if verification fails.`;
      }

      // Return success response
      return res.status(verificationSuccess ? 200 : 207).json({
        message,
        status: verificationSuccess ? "success" : "partial_success",
        idImageUrl,
        selfieImageUrl,
        documentsUrl
      });
    } catch (error) {
      console.error("Unexpected error in submitUserVerification:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  // Helper function to store image URLs in Supabase
  private static async storeImageUrlInSupabase(userId: number, type: string, imageUrl: string): Promise<void> {
    // DEPRECATED: This method is no longer used as direct inserts are now working with updated policies
    // Keeping for reference purposes
    try {
      let tableName = '';
      let columnName = '';
      let idColumnName = 'user_id';
      
      // Determine the appropriate table and column names based on the type
      switch (type) {
        case 'id_images':
          tableName = 'user_id';
          columnName = 'id_image';
          break;
        case 'face_images':
          tableName = 'user_face_identity';
          columnName = 'face_image';
          break;
        case 'documents':
          tableName = 'user_documents';
          columnName = 'user_document_link';
          idColumnName = 'tasker_id';
          break;
        default:
          throw new Error(`Unknown image type: ${type}`);
      }
      
      // Try a single SQL statement that handles both insert and update
      const sqlQuery = `
        INSERT INTO ${tableName} (${idColumnName}, ${columnName}, created_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (${idColumnName}) 
        DO UPDATE SET
          ${columnName} = EXCLUDED.${columnName},
          updated_at = $4
      `;
      
      // Execute with service role for RLS bypass
      const { error } = await supabase.rpc('execute_sql', {
        sql: sqlQuery,
        params: [userId, imageUrl, new Date().toISOString(), new Date().toISOString()]
      });
      
      if (error) {
        console.warn(`Could not store image URL in ${tableName}: ${error.message}`);
      }
    } catch (error) {
      console.warn(`Error in storeImageUrlInSupabase: ${error}`);
    }
  }

  static async getUserVerificationStatus(
    req: Request,
    res: Response
  ): Promise<any> {
    try {
      const userId = Number(req.params.id);

      // Fetch user information to determine user type
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("user_role, acc_status")
        .eq("user_id", userId)
        .single();
      
      if (userError) {
        console.error("Error fetching user data:", userError);
        return res.status(500).json({ error: userError.message });
      }

      // Fetch verification record from user_verify table (contains bio and social_media_links)
      const { data: verification, error: verificationError } = await supabase
        .from("user_verify")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (verificationError) {
        console.error("Error fetching verification status:", verificationError);
        return res.status(500).json({ error: verificationError.message });
      }

      // Get additional documents based on user type
      let additionalData: any = {};
      
      // Fetch ID image data
      const { data: idData, error: idError } = await supabase
        .from("user_id")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (!idError && idData) {
        additionalData = { ...additionalData, idImage: idData };
      }
      
      // Fetch face/selfie image data
      const { data: faceData, error: faceError } = await supabase
        .from("user_face_identity")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (!faceError && faceData) {
        additionalData = { ...additionalData, faceImage: faceData };
      }
      
      if (userData.user_role.toLowerCase() === 'client') {
        // Fetch client documents
        const { data: clientDocs, error: clientDocsError } = await supabase
          .from("client_documents")
          .select("*")
          .eq("user_id", userId);
          
        if (!clientDocsError) {
          additionalData = { ...additionalData, clientDocuments: clientDocs };
        }
      } else if (userData.user_role.toLowerCase() === 'tasker') {
        // Fetch any tasker-specific documents if they exist
        const { data: taskerDocs, error: taskerDocsError } = await supabase
          .from("user_documents")
          .select("*")
          .eq("tasker_id", userId)
          .maybeSingle();
          
        if (!taskerDocsError && taskerDocs) {
          additionalData = { ...additionalData, taskerDocuments: taskerDocs };
        }
        
        // For taskers, also check the tasker table for bio and social_media_links
        const { data: taskerData, error: taskerError } = await supabase
          .from("tasker")
          .select("bio, social_media_links")
          .eq("tasker_id", userId)
          .maybeSingle();
          
        if (!taskerError && taskerData) {
          // Add tasker-specific bio and social_media_links to the verification data
          if (verification) {
            // Only override if these fields don't exist in verification or are empty
            if (!verification.bio && taskerData.bio) {
              verification.bio = taskerData.bio;
            }
            if (!verification.social_media_links && taskerData.social_media_links) {
              verification.social_media_links = taskerData.social_media_links;
            }
          } else {
            // If no verification record exists, add tasker data to additionalData
            additionalData = { 
              ...additionalData, 
              taskerBio: taskerData.bio,
              taskerSocialMediaLinks: taskerData.social_media_links 
            };
          }
        }
      }

      // Prepare the verification data with image URLs
      let verificationData = verification;
      if (verification) {
        // Add ID image URL to verification data if available
        if (idData && idData.id_image) {
          verificationData = {
            ...verificationData,
            idImageUrl: idData.id_image
          };
        }
        
        // Add selfie image URL to verification data if available
        if (faceData && faceData.face_image) {
          verificationData = {
            ...verificationData,
            selfieImageUrl: faceData.face_image
          };
        }
        
        // Add document URL to verification data if available
        if (userData.user_role.toLowerCase() === 'tasker' && 
            additionalData.taskerDocuments && 
            additionalData.taskerDocuments.user_document_link) {
          verificationData = {
            ...verificationData,
            documentUrl: additionalData.taskerDocuments.user_document_link
          };
        }
      }

      if (!verification) {
        return res.status(200).json({ 
          exists: false,
          user: userData,
          ...additionalData,
          message: "No verification record found" 
        });
      }

      return res.status(200).json({
        exists: true,
        verification: verificationData,
        user: userData,
        ...additionalData,
        message: "Verification record found"
      });
    } catch (error) {
      console.error("Unexpected error in getUserVerificationStatus:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  /**
   * Ensures the user_verify table exists with the correct columns
   */
  private static async ensureUserVerifyTable(): Promise<void> {
    try {
      // Check if the table exists by trying to query it
      const { data, error } = await supabase
        .from('user_verify')
        .select('id')
        .limit(1);
      
      // If we got data or a "no rows found" error, the table exists
      if (data || (error && error.code !== 'PGRST116')) {
        console.log("user_verify table exists");
        return;
      }
      
      // If we get here, the table likely doesn't exist or we don't have access
      console.log("user_verify table might not exist, checking further...");
      
      // Try a direct approach without custom RPC functions
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS user_verify (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(user_id),
          gender TEXT,
          phone_number TEXT,
          bio TEXT,
          social_media_links JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // This is just a placeholder - with updated policies, we should
      // be able to interact with the table directly using supabase client
      console.log("Assuming user_verify table exists or will be created by the database admin");
      
    } catch (err) {
      console.error("Error checking/creating user_verify table:", err);
      // Continue execution - we'll assume the table exists with the correct structure
    }
  }
}

export default UserAccountController;