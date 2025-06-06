import { mailer, supabase } from "../config/configuration";
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
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

      // Insert into clients table based on user_role (removed tasker table insertion)
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
      }
      // Note: Removed tasker table insertion - only user_verify table is used for verification data

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

      // Validate user ID
      if (!userID || isNaN(Number(userID))) {
        console.error("Invalid user ID provided:", userID);
        return res.status(400).json({ error: "Invalid user ID" });
      }

      //console.log("Step 1: Calling UserAccount.showUser");
      const userData = await UserAccount.showUser(userID);
      //console.log("Step 2: Successfully retrieved user data:", userData);
      
      // Use type assertion to allow adding properties
      const userDataWithExtras: any = { ...userData };

      // Fetch verification images and documents from respective tables
      console.log("Fetching verification files from respective tables...");
      
      // Fetch ID image from user_id table
      const { data: idImageData, error: idImageError } = await supabase
        .from("user_id")
        .select("id_image")
        .eq("user_id", userID)
        .maybeSingle();
      
      if (!idImageError && idImageData) {
        userDataWithExtras.id_image = idImageData.id_image;
        console.log("✅ ID image found:", idImageData.id_image);
      } else {
        console.log("ℹ️ No ID image found");
      }

      // Fetch face/selfie image from user_face_identity table
      const { data: faceImageData, error: faceImageError } = await supabase
        .from("user_face_identity")
        .select("face_image")
        .eq("user_id", userID)
        .maybeSingle();
      
      if (!faceImageError && faceImageData) {
        userDataWithExtras.face_image = faceImageData.face_image;
        console.log("✅ Face image found:", faceImageData.face_image);
      } else {
        console.log("ℹ️ No face image found");
      }

      // Fetch documents from user_documents table
      const { data: documentData, error: documentError } = await supabase
        .from("user_documents")
        .select("user_document_link, valid")
        .eq("tasker_id", userID)
        .maybeSingle();
      
      if (!documentError && documentData) {
        userDataWithExtras.document_link = documentData.user_document_link;
        userDataWithExtras.document_valid = documentData.valid;
        console.log("✅ Document found:", documentData.user_document_link);
      } else {
        console.log("ℹ️ No documents found");
      }

      //console.log("Step 6: Checking user role:", userDataWithExtras.user_role);
      if (userDataWithExtras.user_role.toLowerCase() === "client") {
        console.log("Processing client user...");
        const clientData = await UserAccount.showClient(userID);
        console.log("Client data retrieved:", clientData);
        if(!clientData) {
          console.log("No client data found, returning error");
          res.status(404).json({ error: "Please Verify Your Account First." });
          return;
        }
        console.log("Sending successful client response");
        res.status(200).json({ 
          user: userDataWithExtras, 
          client: clientData,
          verification_status: {
            has_id_image: !!userDataWithExtras.id_image,
            has_face_image: !!userDataWithExtras.face_image,
            has_documents: !!userDataWithExtras.document_link,
            account_status: userDataWithExtras.acc_status
          }
        });
        console.log("Client Data: " + clientData);
      } else if (userDataWithExtras.user_role.toLowerCase() === "tasker") {
        console.log("Processing tasker user...");
        try {
          // Fetch tasker verification data directly from tasker table
          console.log("Fetching tasker verification data from tasker table...");
          const { data: taskerVerificationData, error: taskerVerificationError } = await supabase
            .from("tasker")
            .select("bio, social_media_links, specialization_id, skills, wage_per_hour, pay_period, availability, rating")
            .eq("user_id", userID)
            .maybeSingle();

          if (!taskerVerificationError && taskerVerificationData) {
            // Add all tasker verification data to userDataWithExtras
            userDataWithExtras.bio = taskerVerificationData.bio || null;
            userDataWithExtras.social_media_links = taskerVerificationData.social_media_links || null;
            userDataWithExtras.specialization_id = taskerVerificationData.specialization_id || null;
            userDataWithExtras.skills = taskerVerificationData.skills || null;
            userDataWithExtras.wage_per_hour = taskerVerificationData.wage_per_hour || null;
            userDataWithExtras.pay_period = taskerVerificationData.pay_period || null;
            userDataWithExtras.availability = taskerVerificationData.availability || null;
            userDataWithExtras.rating = taskerVerificationData.rating || null;
            console.log("✅ Added tasker verification data from tasker table");
          } else {
            console.log("ℹ️ No tasker verification data found");
          }

          // Get tasker documents
          const { data: taskerDocument, error: taskerDocumentError } = await supabase
            .from("user_documents")
            .select("user_document_link")
            .eq("tasker_id", userID)
            .maybeSingle();

          if (taskerDocumentError) {
            console.warn("Tasker Document Warning:", taskerDocumentError.message);
          }
          
          //console.log("Step 10: Sending tasker response...");
          res.status(200).json({ 
            user: userDataWithExtras, 
            tasker: taskerVerificationData || null, 
            taskerDocument: taskerDocument || null,
            verification_status: {
              has_id_image: !!userDataWithExtras.id_image,
              has_face_image: !!userDataWithExtras.face_image,
              has_documents: !!userDataWithExtras.document_link,
              has_bio: !!userDataWithExtras.bio,
              has_verification_data: !!taskerVerificationData,
              account_status: userDataWithExtras.acc_status
            }
          });
          //console.log("Step 11: Tasker response sent successfully");
        } catch (taskerError) {
          console.error("Error in tasker processing:", taskerError);
          console.error("Tasker error stack:", taskerError instanceof Error ? taskerError.stack : "Unknown error");
          throw taskerError;
        }
      } else {
        console.log("Unknown user role:", userDataWithExtras.user_role);
        return res.status(400).json({ error: "Unknown user role" });
      }
    } catch (error) {
      console.error("Error in getUserData:", error instanceof Error ? error.message : "Unknown error");
      console.error("Error stack:", error instanceof Error ? error.stack : "Unknown error");
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

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      // Save bio to user_verify table only (unified approach)
      if (bio) {
        const { error: verifyError } = await supabase
          .from("user_verify")
          .upsert({
            user_id: userId,
            bio: bio,
            updated_at: new Date().toISOString(),
          });

        if (verifyError) {
          console.warn("Could not update user_verify table:", verifyError);
          // Don't fail the entire operation, just log the warning
        }
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
      
      // // Set verification status - only for new submissions, not updates
      // if (!isUpdateMode) {
      //   updateUser.acc_status = "Review";
      // }
      
      // // Use selfie as profile image if available
      // if (selfieImageUrl) {
      //   updateUser.image_link = selfieImageUrl;
      // }

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      // Save bio to user_verify table only (unified approach)
      if (bio) {
        const { error: verifyError } = await supabase
          .from("user_verify")
          .upsert({
            user_id: userId,
            bio: bio,
            updated_at: new Date().toISOString(),
          });

        if (verifyError) {
          console.warn("Could not update user_verify table:", verifyError);
          // Don't fail the entire operation, just log the warning
        }
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

      // Store basic info in the user table (including gender and phone since user_verify doesn't have them)
      const updateUser: any = {};
      if (first_name) updateUser.first_name = first_name;
      if (middle_name) updateUser.middle_name = middle_name;
      if (last_name) updateUser.last_name = last_name;
      if (email) updateUser.email = email;
      if (gender) updateUser.gender = gender;
      if (contact) updateUser.contact = contact;
      if (birthdate) updateUser.birthdate = birthdate;
      
      // // Set verification status - only for new submissions, not updates
      // if (!isUpdateMode) {
      //   updateUser.acc_status = "Review";
      // }
      
      // // Use selfie as profile image if available
      // if (selfieImageUrl) {
      //   updateUser.image_link = selfieImageUrl;
      // }

      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", userId);

      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      // Save bio to user_verify table only (unified approach)
      if (bio) {
        const { error: verifyError } = await supabase
          .from("user_verify")
          .upsert({
            user_id: userId,
            bio: bio,
            updated_at: new Date().toISOString(),
          });

        if (verifyError) {
          console.warn("Could not update user_verify table:", verifyError);
          // Don't fail the entire operation, just log the warning
        }
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
      // // Step 1: Validate the user_verify table structure first
      console.log("=== VALIDATING USER_VERIFY TABLE STRUCTURE ===");
      const tableValidation = await UserAccountController.validateUserVerifyTableStructure();
      
      if (!tableValidation.valid) {
        console.error("❌ user_verify table validation failed:", tableValidation);
        
        // Check if essential columns are missing (user_id, bio, social_media_links)
        const essentialColumns = ['user_id', 'bio', 'social_media_links'];
        const missingEssentialColumns = tableValidation.missingColumns.filter(col => 
          essentialColumns.includes(col) || col === 'table_does_not_exist'
        );
        
        if (tableValidation.missingColumns.includes('table_does_not_exist')) {
          return res.status(500).json({
            error: "Database configuration error: user_verify table not found",
            details: "The user_verify table needs to be created",
            hint: "Please run the SQL provided below to create the table",
            sql: `
-- Create the user_verify table
CREATE TABLE user_verify (
  user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
  bio TEXT,
  social_media_links JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_verify_user_id ON user_verify(user_id);

-- Disable RLS for now
ALTER TABLE user_verify DISABLE ROW LEVEL SECURITY;
            `.trim(),
            sqlNeeded: true
          });
        } else if (missingEssentialColumns.length > 0) {
          // Generate specific SQL to fix missing essential columns
          let fixSQL = "-- Fix missing essential columns in user_verify table\n";
          
          if (tableValidation.missingColumns.includes('user_id')) {
            fixSQL += "-- Note: user_id should be the primary key. The table may need to be recreated.\n";
            fixSQL += "-- Consider recreating the table with the full SQL provided above.\n";
          }
          if (tableValidation.missingColumns.includes('bio')) {
            fixSQL += "ALTER TABLE user_verify ADD COLUMN IF NOT EXISTS bio TEXT;\n";
          }
          if (tableValidation.missingColumns.includes('social_media_links')) {
            fixSQL += "ALTER TABLE user_verify ADD COLUMN IF NOT EXISTS social_media_links JSONB DEFAULT '{}';\n";
          }
          
          return res.status(500).json({
            error: "Database schema error: user_verify table has incorrect structure",
            details: `Missing essential columns: ${missingEssentialColumns.join(', ')}`,
            hint: "Please run the SQL provided below to fix the table structure",
            missingColumns: missingEssentialColumns,
            sql: fixSQL.trim(),
            sqlNeeded: true
          });
        } else {
          // Only timestamp columns are missing - warn but continue
          console.warn("⚠️ Non-essential columns missing from user_verify table:", tableValidation.missingColumns);
          console.log("Continuing with verification process...");
          
          if (tableValidation.missingColumns.includes('updated_at') || tableValidation.missingColumns.includes('created_at')) {
            console.log("💡 Recommendation: Add missing timestamp columns to user_verify table:");
            let recommendedSQL = "-- Add missing timestamp columns (recommended but not required)\n";
            
            if (tableValidation.missingColumns.includes('updated_at')) {
              recommendedSQL += "ALTER TABLE user_verify ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;\n";
            }
            if (tableValidation.missingColumns.includes('created_at')) {
              recommendedSQL += "ALTER TABLE user_verify ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;\n";
            }
            
            console.log(recommendedSQL);
          }
        }
      }
      
      console.log("✅ user_verify table structure validated successfully");
      
      // Ensure the user_verify table exists with the correct structure
      await UserAccountController.ensureUserVerifyTable();
      
      const userId = Number(req.params.id);
      const {
        // Frontend sends these field names (from Flutter verification_page.dart)
        gender,
        phone_number, // This should go to user table as 'contact'
        phone, // Alternative field name
        bio,
        social_media_links,
        socialMediaJson, // Alternative field name from frontend
        
        // Additional fields for user table updates
        first_name,
        firstName, // Alternative field name from frontend
        middle_name,
        middleName, // Alternative field name from frontend  
        last_name,
        lastName, // Alternative field name from frontend
        email,
        birthdate,
        user_role,
        userRole, // Alternative field name from frontend
        
        // Flag to indicate if this is an update to existing verification
        is_update,
        status, // Alternative field for update mode
      } = req.body;

      // Handle alternative field names from frontend
      const isUpdateMode = is_update === 'true' || status !== undefined;
      const userFirstName = first_name || firstName;
      const userMiddleName = middle_name || middleName;
      const userLastName = last_name || lastName;
      const submittedUserRole = user_role || userRole || 'tasker';
      const userPhone = phone_number || phone;
      const userSocialMediaLinks = social_media_links || socialMediaJson || '{}';
      
      console.log("=== USER VERIFICATION SUBMISSION ===");
      console.log("Received User Verification Data:", req.body);
      console.log("Is update mode:", isUpdateMode);
      console.log("User role:", submittedUserRole);

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

      // Get the user's current role for processing
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("user_role, acc_status, first_name, middle_name, last_name, email, contact, gender, birthdate")
        .eq("user_id", userId)
        .single();
        
      if (userError) {
        console.error("Error fetching user role:", userError);
        return res.status(500).json({ error: "Unable to determine user type" });
      }
      
      const currentUserRole = userData.user_role || "Unknown";
      console.log(`Processing verification for ${currentUserRole} user`);
      
      // Verification is now supported for both taskers and clients
      const supportedRoles = ['tasker', 'client'];
      if (!supportedRoles.includes(currentUserRole.toLowerCase())) {
        return res.status(400).json({ 
          error: `Verification is not supported for user role: ${currentUserRole}`,
          supportedRoles: supportedRoles,
          userRole: currentUserRole
        });
      }

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      let idImageUrl: string | null = null;
      let selfieImageUrl: string | null = null;
      let documentsUrl: string | null = null;

      // Upload ID image if provided
      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `${currentUserRole.toLowerCase()}s/id_${userId}_${Date.now()}_${idImageFile.originalname}`;

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
        const fileName = `${currentUserRole.toLowerCase()}s/selfie_${userId}_${Date.now()}_${selfieImageFile.originalname}`;

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
        const fileName = `${currentUserRole.toLowerCase()}s/documents_${userId}_${Date.now()}_${documentFile.originalname}`;

        console.log("Uploading Documents:", fileName);
        console.log("Document MIME Type:", documentFile.mimetype);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, documentFile.buffer, {
            contentType: documentFile.mimetype, // Add this line to fix PDF viewing
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

      console.log("File Upload Results:");
      console.log("- ID Image URL:", idImageUrl);
      console.log("- Selfie Image URL:", selfieImageUrl);
      console.log("- Documents URL:", documentsUrl);

      // // Step 1: Update the main user table with basic information
      // The user_verify table only contains bio and social_media_links
      // All other data (name, email, gender, phone, etc.) goes to the main user table
      const updateUser: any = {};
      
      if (userFirstName) updateUser.first_name = userFirstName;
      if (userMiddleName) updateUser.middle_name = userMiddleName;
      if (userLastName) updateUser.last_name = userLastName;
      if (email) updateUser.email = email;
      if (gender) updateUser.gender = gender;
      if (userPhone) updateUser.contact = userPhone;
      if (birthdate) updateUser.birthdate = birthdate;
      
      // Set verification status - only for new submissions, not updates
      if (!isUpdateMode) {
        updateUser.acc_status = "Review";
      }
      
      // Use selfie as profile image if available
      if (selfieImageUrl) {
        updateUser.image_link = selfieImageUrl;
      }

      // Update user table
      if (Object.keys(updateUser).length > 0) {
        console.log("Updating main user table with:", updateUser);
        
        const { error: updateUserError } = await supabase
          .from("user")
          .update(updateUser)
          .eq("user_id", userId);

        if (updateUserError) {
          console.error("Error updating user table:", updateUserError);
          return res.status(500).json({ error: updateUserError.message });
        }
        
        console.log("✅ Successfully updated main user table");
      }

      // // Step 2: Handle user_verify table - ONLY bio and social_media_links
      console.log("=== SAVING TO USER_VERIFY TABLE ===");
      console.log("Processing verification data for user_verify table...");
      
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
        console.error("Check error details:", {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint
        });
        // Don't return error here, continue with the process
      }
      
      console.log("Existing verification record:", existingVerification);
      
      // Prepare verification data with ONLY the columns that exist in user_verify table
      const verificationData: any = {
        user_id: userId,
        bio: bio || '', // Text field for bio
        social_media_links: userSocialMediaLinks, // JSONB field for social media links
      };
      
      // Only add timestamp columns if they exist in the table
      // If updated_at column exists, add it
      if (!tableValidation.missingColumns.includes('updated_at')) {
        verificationData.updated_at = currentDate;
      }
      
      // Ensure social_media_links is valid JSON
      if (typeof verificationData.social_media_links === 'string') {
        try {
          // Test if it's valid JSON
          JSON.parse(verificationData.social_media_links);
        } catch (e) {
          console.warn("Invalid JSON in social_media_links, using empty object");
          verificationData.social_media_links = '{}';
        }
      } else if (typeof verificationData.social_media_links === 'object') {
        // Convert object to JSON string
        verificationData.social_media_links = JSON.stringify(verificationData.social_media_links);
      } else {
        verificationData.social_media_links = '{}';
      }
      
      // Only add created_at for new records if the column exists
      if (!existingVerification && !tableValidation.missingColumns.includes('created_at')) {
        verificationData.created_at = currentDate;
      }
      
      console.log("Final verification data for user_verify table:", verificationData);
      console.log("Data types:", {
        user_id: typeof verificationData.user_id,
        bio: typeof verificationData.bio,
        social_media_links: typeof verificationData.social_media_links,
        created_at: typeof verificationData.created_at,
        updated_at: typeof verificationData.updated_at
      });
      
      // Save to user_verify table
      let verifyData = null;
      let verifyError = null;
      
      if (existingVerification) {
        console.log("Updating existing verification record in user_verify table...");
        const updateFields: any = {
          bio: verificationData.bio,
          social_media_links: verificationData.social_media_links,
        };
        
        // Only add updated_at if the column exists
        if (!tableValidation.missingColumns.includes('updated_at')) {
          updateFields.updated_at = verificationData.updated_at;
        }
        
        const updateResult = await supabase
          .from('user_verify')
          .update(updateFields)
          .eq('user_id', userId)
          .select();
          
        verifyData = updateResult.data;
        verifyError = updateResult.error;
      } else {
        console.log("Inserting new verification record into user_verify table...");
        const insertResult = await supabase
          .from('user_verify')
          .insert(verificationData)
          .select();
          
        verifyData = insertResult.data;
        verifyError = insertResult.error;
      }
      
      if (verifyError) {
        console.error("❌ Error saving to user_verify table:", verifyError);
        console.error("Error details:", {
          code: verifyError.code,
          message: verifyError.message,
          details: verifyError.details,
          hint: verifyError.hint
        });
        
        console.error("Raw error object:", JSON.stringify(verifyError, null, 2));
        
        // Handle specific error cases
        if (verifyError.code === '42P01') { // Table doesn't exist
          console.warn("user_verify table doesn't exist");
          return res.status(500).json({
            error: "Database configuration error: user_verify table not found",
            details: "Please create the user_verify table using the SQL provided in the logs",
            hint: "Contact your database administrator"
          });
        } else if (verifyError.code === '23503') { // Foreign key constraint
          return res.status(500).json({ 
            error: "Invalid user ID or database constraint violation",
            details: verifyError.message,
            hint: "Ensure the user exists in the main user table"
          });
        } else if (verifyError.code === '42703') { // Column doesn't exist
          console.error("Column doesn't exist error. Table structure is incorrect.");
          return res.status(500).json({
            error: "Database schema error: user_verify table has incorrect structure",
            details: verifyError.message,
            hint: "Please run the table creation SQL provided in the logs"
          });
        } else if (verifyError.code === '42501') { // Insufficient privileges
          console.error("Permission denied error. API key lacks write permissions.");
          return res.status(500).json({
            error: "Permission error: Unable to save verification data",
            details: "The API key doesn't have write permissions for the user_verify table"
          });
        } else {
          // For other errors, return with details
          return res.status(500).json({
            error: "Failed to save verification data to user_verify table",
            details: verifyError.message,
            code: verifyError.code
          });
        }
      } else {
        console.log("✅ Successfully saved to user_verify table:", verifyData);
      }

      // // Step 3: Handle image and document storage in separate tables
      console.log("=== SAVING IMAGES AND DOCUMENTS ===");
      console.log(`User ID: ${userId} (${typeof userId})`);
      console.log(`Files to save: ID=${!!idImageUrl}, Selfie=${!!selfieImageUrl}, Documents=${!!documentsUrl}`);
      
      // Verify user exists before attempting to save related data
      console.log("Verifying user exists before saving images/documents...");
      const { data: userExists, error: userExistsError } = await supabase
        .from('user')
        .select('user_id')
        .eq('user_id', userId)
        .single();
        
      if (userExistsError || !userExists) {
        console.error("❌ User does not exist, cannot save images/documents:", userExistsError);
        return res.status(400).json({
          error: "User not found - cannot save verification images/documents",
          userId: userId
        });
      }
      console.log("✅ User exists, proceeding with image/document saves");
      
      let verificationSuccess = true;
      let failedTables = [];
      let savedFiles = {
        idImage: false,
        selfieImage: false,
        documents: false
      };
      
      // Save ID image to user_id table if provided
      if (idImageUrl) {
        console.log("=== SAVING ID IMAGE TO user_id TABLE ===");
        console.log("ID Image URL:", idImageUrl);
        
        try {
          // First check if user_id table exists and has correct structure
          const { data: tableTest, error: tableTestError } = await supabase
            .from('user_id')
            .select('user_id, id_image')
            .limit(1);
            
          if (tableTestError && tableTestError.code === '42P01') {
            console.error("❌ user_id table does not exist");
            failedTables.push('user_id (table missing)');
          } else if (tableTestError && tableTestError.code === '42703') {
            console.error("❌ user_id table missing required columns");
            failedTables.push('user_id (incorrect structure)');
          } else {
            const idImageData: any = {
              user_id: userId,
              id_image: idImageUrl,
            };
            
            console.log("Attempting to save ID image data:", idImageData);
            
            // Check if record already exists
            const { data: existingIdRecord, error: checkIdError } = await supabase
              .from('user_id')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle();
            
            let idImageInsertResult, idImageError;
            
            if (existingIdRecord) {
              // Update existing record
              console.log("Updating existing ID image record...");
              const updateResult = await supabase
                .from('user_id')
                .update({ id_image: idImageUrl })
                .eq('user_id', userId)
                .select();
              idImageInsertResult = updateResult.data;
              idImageError = updateResult.error;
            } else {
              // Insert new record
              console.log("Inserting new ID image record...");
              const insertResult = await supabase
                .from('user_id')
                .insert(idImageData)
                .select();
              idImageInsertResult = insertResult.data;
              idImageError = insertResult.error;
            }
            
            if (idImageError) {
              console.error("❌ Error saving ID image:", idImageError);
              console.error("ID Image Error Details:", {
                code: idImageError.code,
                message: idImageError.message,
                details: idImageError.details,
                hint: idImageError.hint
              });
              
              // Provide specific guidance based on error type
              if (idImageError.code === '23503') {
                console.error("Foreign key constraint violation - user may not exist in user table");
              } else if (idImageError.code === '23505') {
                console.error("Unique constraint violation - user_id may already exist in user_id table");
              } else if (idImageError.code === '42501') {
                console.error("Permission denied - check RLS policies and API key permissions");
              }
              
              failedTables.push('user_id');
            } else {
              console.log("✅ Successfully saved ID image to user_id table");
              console.log("Saved data:", idImageInsertResult);
              savedFiles.idImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving ID image:", error);
          failedTables.push('user_id');
        }
      } else {
        console.log("ℹ️ No ID image provided - skipping user_id table save");
      }
      
      // Save selfie image to user_face_identity table if provided
      if (selfieImageUrl) {
        console.log("=== SAVING SELFIE IMAGE TO user_face_identity TABLE ===");
        console.log("Selfie Image URL:", selfieImageUrl);
        
        try {
          // First check if user_face_identity table exists and has correct structure
          const { data: tableTest, error: tableTestError } = await supabase
            .from('user_face_identity')
            .select('user_id, face_image')
            .limit(1);
            
          if (tableTestError && tableTestError.code === '42P01') {
            console.error("❌ user_face_identity table does not exist");
            failedTables.push('user_face_identity (table missing)');
          } else if (tableTestError && tableTestError.code === '42703') {
            console.error("❌ user_face_identity table missing required columns");
            failedTables.push('user_face_identity (incorrect structure)');
          } else {
            const faceImageData: any = {
              user_id: userId,
              face_image: selfieImageUrl,
            };
            
            console.log("Attempting to save selfie image data:", faceImageData);
            
            // Check if record already exists
            const { data: existingFaceRecord, error: checkFaceError } = await supabase
              .from('user_face_identity')
              .select('user_id')
              .eq('user_id', userId)
              .maybeSingle();
            
            let faceImageInsertResult, faceImageError;
            
            if (existingFaceRecord) {
              // Update existing record
              console.log("Updating existing face image record...");
              const updateResult = await supabase
                .from('user_face_identity')
                .update({ face_image: selfieImageUrl })
                .eq('user_id', userId)
                .select();
              faceImageInsertResult = updateResult.data;
              faceImageError = updateResult.error;
            } else {
              // Insert new record
              console.log("Inserting new face image record...");
              const insertResult = await supabase
                .from('user_face_identity')
                .insert(faceImageData)
                .select();
              faceImageInsertResult = insertResult.data;
              faceImageError = insertResult.error;
            }
            
            if (faceImageError) {
              console.error("❌ Error saving selfie image:", faceImageError);
              console.error("Selfie Image Error Details:", {
                code: faceImageError.code,
                message: faceImageError.message,
                details: faceImageError.details,
                hint: faceImageError.hint
              });
              
              // Provide specific guidance based on error type
              if (faceImageError.code === '23503') {
                console.error("Foreign key constraint violation - user may not exist in user table");
              } else if (faceImageError.code === '23505') {
                console.error("Unique constraint violation - user_id may already exist in user_face_identity table");
              } else if (faceImageError.code === '42501') {
                console.error("Permission denied - check RLS policies and API key permissions");
              }
              
              failedTables.push('user_face_identity');
            } else {
              console.log("✅ Successfully saved selfie image to user_face_identity table");
              console.log("Saved data:", faceImageInsertResult);
              savedFiles.selfieImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving selfie image:", error);
          failedTables.push('user_face_identity');
        }
      } else {
        console.log("ℹ️ No selfie image provided - skipping user_face_identity table save");
      }
      
      // Save documents to appropriate table based on user role if provided
      if (documentsUrl) {
        console.log("=== SAVING DOCUMENTS ===");
        console.log("Documents URL:", documentsUrl);
        console.log("User role:", currentUserRole);
        
        try {
          if (currentUserRole.toLowerCase() === 'tasker') {
            // Save to user_documents table for taskers
            console.log("Saving to user_documents table for tasker...");
            
            const { data: tableTest, error: tableTestError } = await supabase
              .from('user_documents')
              .select('tasker_id, user_document_link')
              .limit(1);
              
            if (tableTestError && tableTestError.code === '42P01') {
              console.error("❌ user_documents table does not exist");
              failedTables.push('user_documents (table missing)');
            } else if (tableTestError && tableTestError.code === '42703') {
              console.error("❌ user_documents table missing required columns");
              failedTables.push('user_documents (incorrect structure)');
            } else {
              const documentData: any = {
                tasker_id: userId, // Note: this table uses tasker_id instead of user_id
                user_document_link: documentsUrl,
                valid: false, // Set to false initially, admin will validate
              };
              
              console.log("Attempting to save tasker document data:", documentData);
              
              // Check if record already exists
              const { data: existingDocRecord, error: checkDocError } = await supabase
                .from('user_documents')
                .select('tasker_id')
                .eq('tasker_id', userId)
                .maybeSingle();
              
              let documentInsertResult, documentError;
              
              if (existingDocRecord) {
                // Update existing record
                console.log("Updating existing document record...");
                const updateResult = await supabase
                  .from('user_documents')
                  .update({ 
                    user_document_link: documentsUrl,
                    valid: false 
                  })
                  .eq('tasker_id', userId)
                  .select();
                documentInsertResult = updateResult.data;
                documentError = updateResult.error;
              } else {
                // Insert new record
                console.log("Inserting new document record...");
                const insertResult = await supabase
                  .from('user_documents')
                  .insert(documentData)
                  .select();
                documentInsertResult = insertResult.data;
                documentError = insertResult.error;
              }
              
              if (documentError) {
                console.error("❌ Error saving tasker documents:", documentError);
                console.error("Document Error Details:", {
                  code: documentError.code,
                  message: documentError.message,
                  details: documentError.details,
                  hint: documentError.hint
                });
                
                // Provide specific guidance based on error type
                if (documentError.code === '23503') {
                  console.error("Foreign key constraint violation - user may not exist in user table");
                } else if (documentError.code === '23505') {
                  console.error("Unique constraint violation - tasker_id may already exist in user_documents table");
                } else if (documentError.code === '42501') {
                  console.error("Permission denied - check RLS policies and API key permissions");
                }
                
                failedTables.push('user_documents');
              } else {
                console.log("✅ Successfully saved documents to user_documents table");
                console.log("Saved data:", documentInsertResult);
                savedFiles.documents = true;
              }
            }
          } else if (currentUserRole.toLowerCase() === 'client') {
            // Save to user_documents table for clients (using same structure as taskers)
            console.log("Saving to user_documents table for client...");
            
            const { data: tableTest, error: tableTestError } = await supabase
              .from('user_documents')
              .select('tasker_id, user_document_link')
              .limit(1);
              
            if (tableTestError && tableTestError.code === '42P01') {
              console.error("❌ user_documents table does not exist");
              failedTables.push('user_documents (table missing)');
            } else if (tableTestError && tableTestError.code === '42703') {
              console.error("❌ user_documents table missing required columns");
              failedTables.push('user_documents (incorrect structure)');
            } else {
              const documentData: any = {
                tasker_id: userId, // Note: using tasker_id column for both taskers and clients
                user_document_link: documentsUrl,
                valid: false, // Set to false initially, admin will validate
              };
              
              console.log("Attempting to save client document data:", documentData);
              
              // Check if record already exists
              const { data: existingDocRecord, error: checkDocError } = await supabase
                .from('user_documents')
                .select('tasker_id')
                .eq('tasker_id', userId)
                .maybeSingle();
              
              let documentInsertResult, documentError;
              
              if (existingDocRecord) {
                // Update existing record
                console.log("Updating existing document record...");
                const updateResult = await supabase
                  .from('user_documents')
                  .update({ 
                    user_document_link: documentsUrl,
                    valid: false 
                  })
                  .eq('tasker_id', userId)
                  .select();
                documentInsertResult = updateResult.data;
                documentError = updateResult.error;
              } else {
                // Insert new record
                console.log("Inserting new document record...");
                const insertResult = await supabase
                  .from('user_documents')
                  .insert(documentData)
                  .select();
                documentInsertResult = insertResult.data;
                documentError = insertResult.error;
              }
              
              if (documentError) {
                console.error("❌ Error saving client documents:", documentError);
                console.error("Document Error Details:", {
                  code: documentError.code,
                  message: documentError.message,
                  details: documentError.details,
                  hint: documentError.hint
                });
                
                // Provide specific guidance based on error type
                if (documentError.code === '23503') {
                  console.error("Foreign key constraint violation - user may not exist in user table");
                } else if (documentError.code === '23505') {
                  console.error("Unique constraint violation - tasker_id may already exist in user_documents table");
                } else if (documentError.code === '42501') {
                  console.error("Permission denied - check RLS policies and API key permissions");
                }
                
                failedTables.push('user_documents');
              } else {
                console.log("✅ Successfully saved documents to user_documents table");
                console.log("Saved data:", documentInsertResult);
                savedFiles.documents = true;
              }
            }
          } else {
            console.warn("⚠️ Unknown user role for document storage:", currentUserRole);
            failedTables.push(`documents (unsupported role: ${currentUserRole})`);
          }
        } catch (error) {
          console.error("❌ Exception while saving documents:", error);
          failedTables.push('documents');
        }
      } else {
        console.log("ℹ️ No documents provided - skipping document table save");
      }
      
      // Update overall verification success based on file saves
      if (failedTables.length > 0) {
        verificationSuccess = false;
        console.warn("⚠️ Some files failed to save:", failedTables);
      }
      
      console.log("=== FILE SAVE SUMMARY ===");
      console.log("Files saved successfully:", savedFiles);
      console.log("Failed tables:", failedTables);
      console.log("Overall file save success:", verificationSuccess);
      
      // // Step 4: Prepare response
      console.log("=== PREPARING RESPONSE ===");
      
      let message;
      let verificationSavedSuccessfully = !verifyError;
      
      if (isUpdateMode) {
        message = (verificationSuccess && verificationSavedSuccessfully)
          ? "Your verification information has been updated successfully!" 
          : `Your verification information was partially updated. ${failedTables.length > 0 ? `There were problems with: ${failedTables.join(', ')}.` : ''} Your main profile information was saved successfully.`;
      } else {
        message = (verificationSuccess && verificationSavedSuccessfully)
          ? "Verification submitted successfully! Your information will be reviewed shortly." 
          : `Verification submitted successfully! Your main information and files were saved. ${failedTables.length > 0 ? `Note: Some additional data could not be saved to: ${failedTables.join(', ')}.` : ''} Your verification will be reviewed shortly.`;
      }

      const overallSuccess = verificationSavedSuccessfully; // Main criteria is user_verify table save
      
      console.log("=== VERIFICATION SUBMISSION COMPLETE ===");
      console.log("Overall success:", overallSuccess);
      console.log("Message:", message);
      
      return res.status(overallSuccess ? 200 : 207).json({
        success: overallSuccess,
        message,
        status: overallSuccess ? "success" : "partial_success",
        data: {
          verificationSaved: verificationSavedSuccessfully,
          userTableUpdated: Object.keys(updateUser).length > 0,
          filesUploaded: {
            idImage: !!idImageUrl,
            selfieImage: !!selfieImageUrl,
            documents: !!documentsUrl
          },
          filesSavedToTables: savedFiles,
          urls: {
            idImageUrl,
            selfieImageUrl,
            documentsUrl
          },
          tablesSaved: {
            user_verify: verificationSavedSuccessfully,
            user_id: savedFiles.idImage,
            user_face_identity: savedFiles.selfieImage,
            user_documents: savedFiles.documents
          }
        },
        failedTables: failedTables.length > 0 ? failedTables : undefined
      });
      
    } catch (error) {
      console.error("Unexpected error in submitUserVerification:", error);
      return res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
          hint: "Check server logs for detailed error information"
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

  static async getUserVerificationStatus(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);

      // Fetch user information to determine user type
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("user_role, acc_status, first_name, middle_name, last_name, email, contact, gender, birthdate")
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
      
      // Fetch ID image data from user_id table
      console.log("Fetching ID image data from user_id table...");
      const { data: idData, error: idError } = await supabase
        .from("user_id")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (!idError && idData) {
        additionalData = { ...additionalData, idImage: idData };
        console.log("✅ ID image data found:", idData.id_image);
      } else {
        console.log("ℹ️ No ID image data found for user:", userId);
      }
      
      // Fetch face/selfie image data from user_face_identity table
      console.log("Fetching face image data from user_face_identity table...");
      const { data: faceData, error: faceError } = await supabase
        .from("user_face_identity")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
        
      if (!faceError && faceData) {
        additionalData = { ...additionalData, faceImage: faceData };
        console.log("✅ Face image data found:", faceData.face_image);
      } else {
        console.log("ℹ️ No face image data found for user:", userId);
      }
      
      // Fetch documents from user_documents table (for both taskers and clients)
      console.log("Fetching documents from user_documents table...");
      const { data: documentData, error: documentError } = await supabase
        .from("user_documents")
        .select("*")
        .eq("tasker_id", userId) // Note: this table uses tasker_id for both taskers and clients
        .maybeSingle();
        
      if (!documentError && documentData) {
        additionalData = { ...additionalData, userDocuments: documentData };
        console.log("✅ Document data found:", documentData.user_document_link);
      } else {
        console.log("ℹ️ No document data found for user:", userId);
      }
      
      if (userData.user_role.toLowerCase() === 'client') {
        // Fetch client-specific documents if they exist in client_documents table
        console.log("Fetching client documents from client_documents table...");
        const { data: clientDocs, error: clientDocsError } = await supabase
          .from("client_documents")
          .select("*")
          .eq("user_id", userId);
          
        if (!clientDocsError && clientDocs && clientDocs.length > 0) {
          additionalData = { ...additionalData, clientDocuments: clientDocs };
          console.log("✅ Client documents found:", clientDocs.length, "documents");
        } else {
          console.log("ℹ️ No client documents found in client_documents table");
        }
      } else if (userData.user_role.toLowerCase() === 'tasker') {
        // Note: We no longer read bio and social_media_links from tasker table
        // All verification data should come from user_verify table only
        console.log("Tasker verification data comes from user_verify table");
      }

      // Prepare the verification data with image URLs
      let verificationData = verification;
      if (verification) {
        console.log("=== ADDING IMAGE URLS TO VERIFICATION DATA ===");
        
        // Add the user's account status as the verification status
        verificationData = {
          ...verificationData,
          status: userData.acc_status, // Use acc_status from user table as verification status
          // Add basic user information that VerificationModel expects
          first_name: userData.first_name || '',
          middle_name: userData.middle_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          phone: userData.contact || '',
          gender: userData.gender || '',
          birthdate: userData.birthdate || ''
        };
        console.log("✅ Added verification status from user acc_status:", userData.acc_status);
        
        // Add ID image URL to verification data if available
        if (idData && idData.id_image) {
          verificationData = {
            ...verificationData,
            idImageUrl: idData.id_image
          };
          console.log("✅ Added ID image URL to verification data");
        }
        
        // Add selfie image URL to verification data if available
        if (faceData && faceData.face_image) {
          verificationData = {
            ...verificationData,
            selfieImageUrl: faceData.face_image
          };
          console.log("✅ Added selfie image URL to verification data");
        }
        
        // Add document URL to verification data if available (for both taskers and clients)
        if (documentData && documentData.user_document_link) {
          verificationData = {
            ...verificationData,
            documentUrl: documentData.user_document_link,
            documentValid: documentData.valid || false
          };
          console.log("✅ Added document URL to verification data");
        }
        
        // Also add client documents URL if available
        if (userData.user_role.toLowerCase() === 'client' && 
            additionalData.clientDocuments && 
            additionalData.clientDocuments.length > 0) {
          // Add the first client document URL (if multiple exist)
          const firstClientDoc = additionalData.clientDocuments[0];
          if (firstClientDoc.document_url) {
            verificationData = {
              ...verificationData,
              clientDocumentUrl: firstClientDoc.document_url,
              clientDocumentType: firstClientDoc.document_type || 'unknown'
            };
            console.log("✅ Added client document URL to verification data");
          }
        }
        
        console.log("=== FINAL VERIFICATION DATA ===");
        console.log("Verification status:", verificationData.status);
        console.log("User acc_status:", userData.acc_status);
        console.log("Has ID image:", !!verificationData.idImageUrl);
        console.log("Has selfie image:", !!verificationData.selfieImageUrl);
        console.log("Has document:", !!verificationData.documentUrl);
        console.log("Has client document:", !!verificationData.clientDocumentUrl);
        console.log("Full verification data:", verificationData);
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
        success: true,
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
      console.log("Checking if user_verify table exists...");
      
      // Check if the table exists by trying to query it with minimal columns
      const { data, error } = await supabase
        .from('user_verify')
        .select('user_id')
        .limit(1);
      
      // If we got data or a "no rows found" error, the table exists
      if (data !== null || (error && error.code === 'PGRST116')) {
        console.log("user_verify table exists and is accessible");
        return;
      }
      
      // If we get a different error, log it
      if (error) {
        console.error("Error checking user_verify table:", error);
        console.error("Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // If table doesn't exist or has wrong structure, provide SQL
        if (error.code === '42P01' || error.code === '42703' || error.message.includes('does not exist')) {
          console.log("Table doesn't exist or has wrong structure. Please run this SQL in your database:");
          console.log(`
            -- Drop existing table if it has wrong structure
            DROP TABLE IF EXISTS user_verify;
            
            -- Create the correct user_verify table
            CREATE TABLE user_verify (
              user_id INTEGER NOT NULL UNIQUE REFERENCES "user"(user_id) ON DELETE CASCADE,
              bio TEXT,
              social_media_links JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id)
            );
            
            -- Create index for faster lookups
            CREATE INDEX IF NOT EXISTS idx_user_verify_user_id ON user_verify(user_id);
            
            -- Enable Row Level Security (RLS) if needed
            ALTER TABLE user_verify ENABLE ROW LEVEL SECURITY;
            
            -- Create policy to allow authenticated users to read their own data
            CREATE POLICY "Users can view own verification data" ON user_verify
              FOR SELECT USING (auth.uid()::text = user_id::text);
              
            -- Create policy to allow authenticated users to insert/update their own data
            CREATE POLICY "Users can insert own verification data" ON user_verify
              FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
              
            CREATE POLICY "Users can update own verification data" ON user_verify
              FOR UPDATE USING (auth.uid()::text = user_id::text);
              
            -- OR if you prefer to disable RLS for this table (simpler but less secure):
            -- ALTER TABLE user_verify DISABLE ROW LEVEL SECURITY;
          `);
          
          console.log("\n=== TROUBLESHOOTING GUIDE ===");
          console.log("1. If table doesn't exist: Run the CREATE TABLE command above");
          console.log("2. If permission denied: Check your Supabase API key has write permissions");
          console.log("3. If using service role key: Make sure it's properly configured");
          console.log("4. If using anon key: You might need to disable RLS or create proper policies");
          console.log("5. Check your Supabase dashboard for any error logs");
        }
      }
      
    } catch (err) {
      console.error("Error in ensureUserVerifyTable:", err);
      // Continue execution - we'll assume the table exists or will be created manually
    }
  }

  static async testUserVerifyTable(req: Request, res: Response): Promise<any> {
    try {
      console.log("Testing user_verify table accessibility...");
      
      // Test 1: Check if table exists
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_verify')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error("Table check failed:", tableError);
        return res.status(500).json({
          success: false,
          error: "user_verify table is not accessible",
          details: {
            code: tableError.code,
            message: tableError.message,
            hint: tableError.hint
          }
        });
      }
      
      // Test 2: Try to insert a test record
      const testUserId = 999999; // Use a non-existent user ID for testing
      const testData = {
        user_id: testUserId,
        bio: 'test',
        social_media_links: '{"test": "test"}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: insertTest, error: insertError } = await supabase
        .from('user_verify')
        .insert(testData)
        .select();
      
      if (insertError) {
        console.error("Insert test failed:", insertError);
        
        // Clean up any partial insert
        await supabase
          .from('user_verify')
          .delete()
          .eq('user_id', testUserId);
          
        return res.status(200).json({
          success: false,
          message: "Table exists but insert failed (this might be expected due to foreign key constraints)",
          tableAccessible: true,
          insertWorking: false,
          error: {
            code: insertError.code,
            message: insertError.message,
            hint: insertError.hint
          }
        });
      }
      
      // Clean up test record
      await supabase
        .from('user_verify')
        .delete()
        .eq('user_id', testUserId);
      
      return res.status(200).json({
        success: true,
        message: "user_verify table is fully functional",
        tableAccessible: true,
        insertWorking: true,
        testData: insertTest
      });
      
    } catch (error) {
      console.error("Test failed with exception:", error);
      return res.status(500).json({
        success: false,
        error: "Test failed with exception",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  static async debugUserVerifyInsert(req: Request, res: Response): Promise<any> {
    try {
      console.log("=== Debug User Verify Insert ===");
      
      const userId = Number(req.params.id || 291); // Default to user 291
      console.log("Testing with user ID:", userId);
      
      // // Step 1: Check if table exists and is accessible
      //console.log("Step 1: Checking table accessibility...");
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_verify')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error("Table access failed:", tableError);
        return res.status(500).json({
          success: false,
          step: "table_check",
          error: tableError
        });
      }
      
      console.log("✅ Table is accessible");
      console.log("Current records in table:", tableCheck?.length || 0);
      
      // // Step 2: Check existing record for this user
      //console.log("Step 2: Checking for existing record...");
      const { data: existingRecord, error: existingError } = await supabase
        .from('user_verify')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (existingError) {
        console.error("Error checking existing record:", existingError);
        return res.status(500).json({
          success: false,
          step: "existing_check",
          error: existingError
        });
      }
      
      console.log("Existing record:", existingRecord);
      
      // // Step 3: Try simple insert/update
      //console.log("Step 3: Attempting upsert...");
      const testData = {
        user_id: userId,
        bio: 'Debug test bio - ' + new Date().toISOString(),
        social_media_links: JSON.stringify({
          test: 'debug',
          timestamp: new Date().toISOString()
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log("Test data to insert:", testData);
      
      const { data: insertResult, error: insertError } = await supabase
        .from('user_verify')
        .upsert(testData, { onConflict: 'user_id' })
        .select();
      
      if (insertError) {
        console.error("❌ Insert failed:", insertError);
        return res.status(500).json({
          success: false,
          step: "insert",
          error: insertError,
          testData: testData
        });
      }
      
      console.log("✅ Insert successful:", insertResult);
      
      // // Step 4: Verify the record was saved
      //console.log("Step 4: Verifying record was saved...");
      const { data: verifyResult, error: verifyError } = await supabase
        .from('user_verify')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (verifyError) {
        console.error("Verification failed:", verifyError);
        return res.status(500).json({
          success: false,
          step: "verification",
          error: verifyError
        });
      }
      
      console.log("✅ Record verified:", verifyResult);
      
      return res.status(200).json({
        success: true,
        message: "Debug test completed successfully",
        steps: {
          table_accessible: true,
          insert_successful: true,
          record_verified: true
        },
        data: {
          inserted: insertResult,
          verified: verifyResult,
          testData: testData
        }
      });
      
    } catch (error) {
      console.error("Debug test failed with exception:", error);
      return res.status(500).json({
        success: false,
        step: "exception",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * Validates that the user_verify table has the correct structure
   */
  private static async validateUserVerifyTableStructure(): Promise<{ valid: boolean; missingColumns: string[]; error?: any }> {
    try {
      console.log("Validating user_verify table structure...");
      
      // Try to select specific columns to check if they exist
      const { data, error } = await supabase
        .from('user_verify')
        .select('user_id, bio, social_media_links, created_at, updated_at')
        .limit(1);
      
      if (error) {
        console.error("Table structure validation failed:", error);
        
        // Check for specific error types
        if (error.code === '42P01') {
          return {
            valid: false,
            missingColumns: ['table_does_not_exist'],
            error: error
          };
        } else if (error.code === '42703') {
          // Column doesn't exist - identify which one from the error message
          const missingColumns = [];
          
          if (error.message.includes('updated_at')) {
            missingColumns.push('updated_at');
          }
          if (error.message.includes('created_at')) {
            missingColumns.push('created_at');
          }
          if (error.message.includes('bio')) {
            missingColumns.push('bio');
          }
          if (error.message.includes('social_media_links')) {
            missingColumns.push('social_media_links');
          }
          if (error.message.includes('user_id')) {
            missingColumns.push('user_id');
          }
          
          // If we couldn't parse the error, test individual columns
          if (missingColumns.length === 0) {
            const columnsToTest = ['user_id', 'bio', 'social_media_links', 'created_at', 'updated_at'];
            for (const column of columnsToTest) {
              try {
                const { error: colError } = await supabase
                  .from('user_verify')
                  .select(column)
                  .limit(1);
                  
                if (colError && colError.code === '42703') {
                  missingColumns.push(column);
                }
              } catch (colError: any) {
                if (colError.code === '42703') {
                  missingColumns.push(column);
                }
              }
            }
          }
          
          return {
            valid: false,
            missingColumns: missingColumns,
            error: error
          };
        }
        
        return {
          valid: false,
          missingColumns: ['unknown_error'],
          error: error
        };
      }
      
      console.log("✅ user_verify table structure is valid");
      return {
        valid: true,
        missingColumns: []
      };
      
    } catch (err) {
      console.error("Error validating table structure:", err);
      return {
        valid: false,
        missingColumns: ['validation_failed'],
        error: err
      };
    }
  }

  static async testImageDocumentTables(req: Request, res: Response): Promise<any> {
    try {
      console.log("=== TESTING IMAGE AND DOCUMENT TABLES ===");
      
      const tableTests = [];
      
      // Test user_id table
      try {
        const { data: idTableData, error: idTableError } = await supabase
          .from('user_id')
          .select('user_id, id_image, created_at, updated_at')
          .limit(1);
          
        tableTests.push({
          table: 'user_id',
          exists: !idTableError || idTableError.code !== '42P01',
          accessible: !idTableError,
          correctStructure: !idTableError || idTableError.code !== '42703',
          purpose: 'Stores ID/identification images',
          columns: 'user_id (FK), id_image (URL), created_at, updated_at',
          error: idTableError ? {
            code: idTableError.code,
            message: idTableError.message
          } : null,
          recordCount: idTableData?.length || 0
        });
      } catch (error) {
        tableTests.push({
          table: 'user_id',
          exists: false,
          accessible: false,
          correctStructure: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Test user_face_identity table
      try {
        const { data: faceTableData, error: faceTableError } = await supabase
          .from('user_face_identity')
          .select('user_id, face_image, created_at, updated_at')
          .limit(1);
          
        tableTests.push({
          table: 'user_face_identity',
          exists: !faceTableError || faceTableError.code !== '42P01',
          accessible: !faceTableError,
          correctStructure: !faceTableError || faceTableError.code !== '42703',
          purpose: 'Stores selfie/face verification images',
          columns: 'user_id (FK), face_image (URL), created_at, updated_at',
          error: faceTableError ? {
            code: faceTableError.code,
            message: faceTableError.message
          } : null,
          recordCount: faceTableData?.length || 0
        });
      } catch (error) {
        tableTests.push({
          table: 'user_face_identity',
          exists: false,
          accessible: false,
          correctStructure: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Test user_documents table
      try {
        const { data: docTableData, error: docTableError } = await supabase
          .from('user_documents')
          .select('tasker_id, user_document_link, valid, created_at, updated_at')
          .limit(1);
          
        tableTests.push({
          table: 'user_documents',
          exists: !docTableError || docTableError.code !== '42P01',
          accessible: !docTableError,
          correctStructure: !docTableError || docTableError.code !== '42703',
          purpose: 'Stores tasker verification documents (PDFs, etc.)',
          columns: 'tasker_id (FK), user_document_link (URL), valid (boolean), created_at, updated_at',
          error: docTableError ? {
            code: docTableError.code,
            message: docTableError.message
          } : null,
          recordCount: docTableData?.length || 0
        });
      } catch (error) {
        tableTests.push({
          table: 'user_documents',
          exists: false,
          accessible: false,
          correctStructure: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Check overall status
      const allTablesOk = tableTests.every(test => test.exists && test.accessible && test.correctStructure);
      const missingTables = tableTests.filter(test => !test.exists).map(test => test.table);
      const inaccessibleTables = tableTests.filter(test => test.exists && !test.accessible).map(test => test.table);
      const wrongStructureTables = tableTests.filter(test => test.exists && test.accessible && !test.correctStructure).map(test => test.table);
      
      return res.status(200).json({
        success: allTablesOk,
        message: allTablesOk ? "All image/document tables are properly configured" : "Some tables have issues",
        summary: {
          totalTables: tableTests.length,
          workingTables: tableTests.filter(test => test.exists && test.accessible && test.correctStructure).length,
          missingTables: missingTables.length,
          inaccessibleTables: inaccessibleTables.length,
          wrongStructureTables: wrongStructureTables.length
        },
        issues: {
          missing: missingTables,
          inaccessible: inaccessibleTables,
          wrongStructure: wrongStructureTables
        },
        tableDetails: tableTests,
        recommendations: [
          "1. Ensure all tables exist in your Supabase database",
          "2. Check that your API key has read/write permissions for these tables",
          "3. Verify RLS (Row Level Security) policies allow your operations",
          "4. Make sure foreign key constraints are properly set up",
          "5. Check that column names match exactly: user_id, id_image, face_image, tasker_id, user_document_link"
        ]
      });
      
    } catch (error) {
      console.error("Error testing image/document tables:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to test tables",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * Submit client verification data to the client table
   */
  static async submitClientVerification(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      console.log("=== CLIENT VERIFICATION SUBMISSION ===");
      console.log("User ID:", userId);

      // Get request data
      const {
        bio,
        social_media_links,
        socialMediaJson,
        preferences,
        client_address,
        firstName,
        middleName,
        lastName,
        email,
        phone,
        gender,
        birthdate,
      } = req.body;

      // Update user table first
      const updateUser: any = {};
      if (firstName) updateUser.first_name = firstName;
      if (middleName) updateUser.middle_name = middleName;
      if (lastName) updateUser.last_name = lastName;
      if (email) updateUser.email = email;
      if (gender) updateUser.gender = gender;
      if (phone) updateUser.contact = phone;
      if (birthdate) updateUser.birthdate = birthdate;
      updateUser.acc_status = "Review";

      if (Object.keys(updateUser).length > 0) {
        const { error: updateUserError } = await supabase
          .from("user")
          .update(updateUser)
          .eq("user_id", userId);

        if (updateUserError) {
          return res.status(500).json({ error: updateUserError.message });
        }
      }

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let idImageUrl: string | null = null;
      let selfieImageUrl: string | null = null;
      let documentsUrl: string | null = null;

      // Upload files if provided
      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `clients/id_${userId}_${Date.now()}_${idImageFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, idImageFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          idImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      if (files && files.selfieImage && files.selfieImage.length > 0) {
        const selfieImageFile = files.selfieImage[0];
        const fileName = `clients/selfie_${userId}_${Date.now()}_${selfieImageFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, selfieImageFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          selfieImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      if (files && files.documents && files.documents.length > 0) {
        const documentFile = files.documents[0];
        const fileName = `clients/documents_${userId}_${Date.now()}_${documentFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, documentFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          documentsUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      // Prepare client verification data
      const ClientModel = (await import('../models/clientModel')).default;
      const verificationData = {
        user_id: userId,
        social_media_links: JSON.parse(social_media_links || socialMediaJson || '{}'),
        preferences: preferences || '',
        client_address: client_address || '',
      };

      // Submit to client table
      const result = await ClientModel.submitClientVerification(verificationData);

      // Now save files to respective tables
      let savedFiles = {
        idImage: false,
        selfieImage: false,
        documents: false
      };
      let failedTables: string[] = [];

      // Save ID image to user_id table if provided
      if (idImageUrl) {
        console.log("=== SAVING ID IMAGE TO user_id TABLE ===");
        try {
          const { data: existingIdRecord, error: checkIdError } = await supabase
            .from('user_id')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingIdRecord) {
            // Update existing record
            const { error: updateIdError } = await supabase
              .from('user_id')
              .update({id_image: idImageUrl })
              .eq('user_id', userId);
            
            if (updateIdError) {
              console.error("❌ Error updating ID image:", updateIdError);
              failedTables.push('user_id');
            } else {
              console.log("✅ Successfully updated ID image in user_id table");
              savedFiles.idImage = true;
            }
          } else {
            // Insert new record
            const { error: insertIdError } = await supabase
              .from('user_id')
              .insert({ 
                user_id: userId, 
                id_image: idImageUrl 
              });
            
            if (insertIdError) {
              console.error("❌ Error inserting ID image:", insertIdError);
              failedTables.push('user_id');
            } else {
              console.log("✅ Successfully inserted ID image into user_id table");
              savedFiles.idImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving ID image:", error);
          failedTables.push('user_id');
        }
      }

      // Save selfie image to user_face_identity table if provided
      if (selfieImageUrl) {
        console.log("=== SAVING SELFIE IMAGE TO user_face_identity TABLE ===");
        try {
          const { data: existingFaceRecord, error: checkFaceError } = await supabase
            .from('user_face_identity')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingFaceRecord) {
            // Update existing record
            const { error: updateFaceError } = await supabase
              .from('user_face_identity')
              .update({ face_image: selfieImageUrl })
              .eq('user_id', userId);
            
            if (updateFaceError) {
              console.error("❌ Error updating selfie image:", updateFaceError);
              failedTables.push('user_face_identity');
            } else {
              console.log("✅ Successfully updated selfie image in user_face_identity table");
              savedFiles.selfieImage = true;
            }
          } else {
            // Insert new record
            const { error: insertFaceError } = await supabase
              .from('user_face_identity')
              .insert({ 
                user_id: userId, 
                face_image: selfieImageUrl 
              });
            
            if (insertFaceError) {
              console.error("❌ Error inserting selfie image:", insertFaceError);
              failedTables.push('user_face_identity');
            } else {
              console.log("✅ Successfully inserted selfie image into user_face_identity table");
              savedFiles.selfieImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving selfie image:", error);
          failedTables.push('user_face_identity');
        }
      }

      // Save documents to user_documents table if provided
      if (documentsUrl) {
        console.log("=== SAVING DOCUMENTS TO user_documents TABLE ===");
        try {
          const { data: existingDocRecord, error: checkDocError } = await supabase
            .from('user_documents')
            .select('tasker_id')
            .eq('tasker_id', userId)
            .maybeSingle();

          if (existingDocRecord) {
            // Update existing record
            const { error: updateDocError } = await supabase
              .from('user_documents')
              .update({ 
                user_document_link: documentsUrl,
                valid: false 
              })
              .eq('tasker_id', userId);
            
            if (updateDocError) {
              console.error("❌ Error updating documents:", updateDocError);
              failedTables.push('user_documents');
            } else {
              console.log("✅ Successfully updated documents in user_documents table");
              savedFiles.documents = true;
            }
          } else {
            // Insert new record
            const { error: insertDocError } = await supabase
              .from('user_documents')
              .insert({ 
                tasker_id: userId, // Note: using tasker_id column for both taskers and clients
                user_document_link: documentsUrl,
                valid: false 
              });
            
            if (insertDocError) {
              console.error("❌ Error inserting documents:", insertDocError);
              failedTables.push('user_documents');
            } else {
              console.log("✅ Successfully inserted documents into user_documents table");
              savedFiles.documents = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving documents:", error);
          failedTables.push('user_documents');
        }
      }

      const overallSuccess = failedTables.length === 0;
      const message = overallSuccess 
        ? "Client verification submitted successfully with all files saved!"
        : `Client verification submitted but some files failed to save to tables: ${failedTables.join(', ')}`;

      return res.status(overallSuccess ? 200 : 207).json({
        success: overallSuccess,
        message,
        data: {
          clientData: result,
          files: { idImageUrl, selfieImageUrl, documentsUrl },
          filesSavedToTables: savedFiles,
          tablesSaved: {
            clients: !!result,
            user_id: savedFiles.idImage,
            user_face_identity: savedFiles.selfieImage,
            user_documents: savedFiles.documents
          }
        },
        failedTables: failedTables.length > 0 ? failedTables : undefined
      });

    } catch (error) {
      console.error("Error in submitClientVerification:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * Submit tasker verification data to the tasker table
   */
  static async submitTaskerVerification(req: Request, res: Response): Promise<any> {
    try {
      const userId = Number(req.params.id);
      console.log("=== TASKER VERIFICATION SUBMISSION ===");
      console.log("User ID:", userId);

      // Get request data
      const {
        bio,
        social_media_links,
        socialMediaJson,
        specialization_id,
        skills,
        wage_per_hour,
        pay_period,
        availability,
        firstName,
        middleName,
        lastName,
        email,
        phone,
        gender,
        birthdate,
      } = req.body;

      // Update user table first
      const updateUser: any = {};
      if (firstName) updateUser.first_name = firstName;
      if (middleName) updateUser.middle_name = middleName;
      if (lastName) updateUser.last_name = lastName;
      if (email) updateUser.email = email;
      if (gender) updateUser.gender = gender;
      if (phone) updateUser.contact = phone;
      if (birthdate) updateUser.birthdate = birthdate;
      updateUser.acc_status = "Review";

      if (Object.keys(updateUser).length > 0) {
        const { error: updateUserError } = await supabase
          .from("user")
          .update(updateUser)
          .eq("user_id", userId);

        if (updateUserError) {
          return res.status(500).json({ error: updateUserError.message });
        }
      }

      // Handle file uploads
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let idImageUrl: string | null = null;
      let selfieImageUrl: string | null = null;
      let documentsUrl: string | null = null;

      // Upload files if provided
      if (files && files.idImage && files.idImage.length > 0) {
        const idImageFile = files.idImage[0];
        const fileName = `taskers/id_${userId}_${Date.now()}_${idImageFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, idImageFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          idImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      if (files && files.selfieImage && files.selfieImage.length > 0) {
        const selfieImageFile = files.selfieImage[0];
        const fileName = `taskers/selfie_${userId}_${Date.now()}_${selfieImageFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, selfieImageFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          selfieImageUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      if (files && files.documents && files.documents.length > 0) {
        const documentFile = files.documents[0];
        const fileName = `taskers/documents_${userId}_${Date.now()}_${documentFile.originalname}`;
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, documentFile.buffer, { cacheControl: "3600", upsert: true });
        if (!error) {
          documentsUrl = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
        }
      }

      // Prepare tasker verification data
      const TaskerModel = (await import('../models/taskerModel')).default;
      const verificationData = {
        user_id: userId,
        bio: bio || '',
        social_media_links: JSON.parse(social_media_links || socialMediaJson || '{}'),
        specialization_id: specialization_id ? Number(specialization_id) : undefined,
        skills: skills || '',
        wage_per_hour: wage_per_hour ? Number(wage_per_hour) : 0,
        pay_period: pay_period || 'Hourly',
        availability: availability !== false,
      };

      // Submit to tasker table
      const result = await TaskerModel.submitTaskerVerification(verificationData);

      // Now save files to respective tables (same as client verification)
      let savedFiles = {
        idImage: false,
        selfieImage: false,
        documents: false
      };
      let failedTables: string[] = [];

      // Save ID image to user_id table if provided
      if (idImageUrl) {
        console.log("=== SAVING ID IMAGE TO user_id TABLE ===");
        try {
          const { data: existingIdRecord, error: checkIdError } = await supabase
            .from('user_id')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingIdRecord) {
            // Update existing record
            const { error: updateIdError } = await supabase
              .from('user_id')
              .update({ id_image: idImageUrl })
              .eq('user_id', userId);
            
            if (updateIdError) {
              console.error("❌ Error updating ID image:", updateIdError);
              failedTables.push('user_id');
            } else {
              console.log("✅ Successfully updated ID image in user_id table");
              savedFiles.idImage = true;
            }
          } else {
            // Insert new record
            const { error: insertIdError } = await supabase
              .from('user_id')
              .insert({ 
                user_id: userId, 
                id_image: idImageUrl 
              });
            
            if (insertIdError) {
              console.error("❌ Error inserting ID image:", insertIdError);
              failedTables.push('user_id');
            } else {
              console.log("✅ Successfully inserted ID image into user_id table");
              savedFiles.idImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving ID image:", error);
          failedTables.push('user_id');
        }
      }

      // Save selfie image to user_face_identity table if provided
      if (selfieImageUrl) {
        console.log("=== SAVING SELFIE IMAGE TO user_face_identity TABLE ===");
        try {
          const { data: existingFaceRecord, error: checkFaceError } = await supabase
            .from('user_face_identity')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingFaceRecord) {
            // Update existing record
            const { error: updateFaceError } = await supabase
              .from('user_face_identity')
              .update({ face_image: selfieImageUrl })
              .eq('user_id', userId);
            
            if (updateFaceError) {
              console.error("❌ Error updating selfie image:", updateFaceError);
              failedTables.push('user_face_identity');
            } else {
              console.log("✅ Successfully updated selfie image in user_face_identity table");
              savedFiles.selfieImage = true;
            }
          } else {
            // Insert new record
            const { error: insertFaceError } = await supabase
              .from('user_face_identity')
              .insert({ 
                user_id: userId, 
                face_image: selfieImageUrl 
              });
            
            if (insertFaceError) {
              console.error("❌ Error inserting selfie image:", insertFaceError);
              failedTables.push('user_face_identity');
            } else {
              console.log("✅ Successfully inserted selfie image into user_face_identity table");
              savedFiles.selfieImage = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving selfie image:", error);
          failedTables.push('user_face_identity');
        }
      }

      // Save documents to user_documents table if provided
      if (documentsUrl) {
        console.log("=== SAVING DOCUMENTS TO user_documents TABLE ===");
        try {
          const { data: existingDocRecord, error: checkDocError } = await supabase
            .from('user_documents')
            .select('tasker_id')
            .eq('tasker_id', userId)
            .maybeSingle();

          if (existingDocRecord) {
            // Update existing record
            const { error: updateDocError } = await supabase
              .from('user_documents')
              .update({ 
                user_document_link: documentsUrl,
                valid: false 
              })
              .eq('tasker_id', userId);
            
            if (updateDocError) {
              console.error("❌ Error updating documents:", updateDocError);
              failedTables.push('user_documents');
            } else {
              console.log("✅ Successfully updated documents in user_documents table");
              savedFiles.documents = true;
            }
          } else {
            // Insert new record
            const { error: insertDocError } = await supabase
              .from('user_documents')
              .insert({ 
                tasker_id: userId, // Note: using tasker_id column for taskers
                user_document_link: documentsUrl,
                valid: false 
              });
            
            if (insertDocError) {
              console.error("❌ Error inserting documents:", insertDocError);
              failedTables.push('user_documents');
            } else {
              console.log("✅ Successfully inserted documents into user_documents table");
              savedFiles.documents = true;
            }
          }
        } catch (error) {
          console.error("❌ Exception while saving documents:", error);
          failedTables.push('user_documents');
        }
      }

      const overallSuccess = failedTables.length === 0;
      const message = overallSuccess 
        ? "Tasker verification submitted successfully with all files saved!"
        : `Tasker verification submitted but some files failed to save to tables: ${failedTables.join(', ')}`;

      return res.status(overallSuccess ? 200 : 207).json({
        success: overallSuccess,
        message,
        data: {
          taskerData: result,
          files: { idImageUrl, selfieImageUrl, documentsUrl },
          filesSavedToTables: savedFiles,
          tablesSaved: {
            tasker: !!result,
            user_id: savedFiles.idImage,
            user_face_identity: savedFiles.selfieImage,
            user_documents: savedFiles.documents
          }
        },
        failedTables: failedTables.length > 0 ? failedTables : undefined
      });

    } catch (error) {
      console.error("Error in submitTaskerVerification:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
}

export default UserAccountController;