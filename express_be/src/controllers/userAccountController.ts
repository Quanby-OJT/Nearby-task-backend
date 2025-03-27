import { supabase } from "../config/configuration";
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
import { Auth } from "../models/authenticationModel";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

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
      
      console.log(existingUser, findError)

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

      // Insert user into Supabase database
      

      // Send verification email
      const transporter = nodemailer.createTransport({
        // Configure your email service here
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
      
      const { data: newUser, error: insertError } = await supabase
        .from("user")
        .insert([{
          first_name,
          middle_name,
          last_name,
          email,
          hashed_password: hashedPassword,
          acc_status: 'Pending',
          user_role,
          verification_token: verificationToken
        }])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // inserting null value in clients table
      const { error: errorInsert } = await supabase
        .from("clients")
        .insert([
          {
            user_id: newUser.user_id,
            preferences: '',
            client_address: '',
          },
        ]);

        console.log("New user ID: " + newUser.user_id);

      if(errorInsert) {
        throw new Error(errorInsert.message);
      }
    

      res.status(201).json({
        message: "Registration successful! Please check your email to verify your account.",
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
          acc_status: "Active",
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

  // static async verifyEmail(req: Request, res: Response): Promise<void> {
  //   try {
  //     const { token, email } = req.body;
  //     console.log(req.body)

  //     const verifyToken = await UserAccount.getUser(email)

  //     if(verifyToken.verification_token != token)
  //     {
  //       res.status(401).json({error: "Sorry. Your Email Token has been Expired."})
  //     }

  //     const userId = await UserAccount.resetEmailToken(email)

  //     const sessionToken = randomUUID();

  //     const userLogin = await Auth.insertLogData(userId.user_id, sessionToken);

  //     res.cookie("session", userLogin.session, {
  //       httpOnly: true,
  //       secure: true,
  //       maxAge: 24 * 60 * 60 * 1000,
  //     });

  //     //res.redirect(`myapp://verify?token=${token}&email=${email}`)
  //     res.status(200).json({message: "Successfully Verified Email.", user_id: userId.user_id, session: sessionToken})
  //   } catch (error) {
  //     console.error("Error in verifyEmail:", error instanceof Error ? error.message : "Internal Server Error");
  //     res.status(500).json({error: "An Error Occured while Verifying Email. Please Try Again."});
  //   }
  // }

  // static async createTasker(req: Request, res: Response): Promise<void> {
  //   try {
  //     console.log("Received insert data:", req.body);
  //     const {
  //       gender,
  //       contact_number,
  //       address,
  //       birthdate,
  //       profile_picture,
  //       user_id,
  //       bio,
  //       specialization,
  //       skills,
  //       availability,
  //       wage_per_hour,
  //       tesda_documents_link,
  //       social_media_links,
  //     } = req.body;

  //     const { data: specializations, error: specialization_error } = await supabase.from("tasker_specialization").select("specialization_id").eq("specialization", specialization).single();
  //     if (specialization_error) throw new Error(specialization_error.message);

  //     const { data: tesda_documents, error: tesda_error} = await supabase.from("tesda_documents").select("tesda_documents_id").eq("tesda_documents_link", tesda_documents_link).single();
      
  //     if (tesda_error) throw new Error(tesda_error.message);
  //     if (!tesda_documents) throw new Error("Tesda documents not found");

  //     await taskerModel.createTasker({
  //       gender,
  //       tasker_is_group: false,
  //       contact_number,
  //       address,
  //       birthdate,
  //       profile_picture,
  //       user_id,
  //       bio,
  //       specialization_id: specializations.specialization_id,
  //       skills,
  //       availability,
  //       wage_per_hour,
  //       tesda_documents_id: tesda_documents.tesda_documents_id,
  //       social_media_links
  //     });

  //     res
  //       .status(201)
  //       .json({ taskerStatus: true});
  //   } catch (error) {
  //     console.error("Error in createTasker:", error instanceof Error ? error.message : "Internal Server Error");
  //     res.status(500).json({error: "An Error Occured while Creating Tasker. Please Try Again."});
  //   }
  // }

  // static async deleteUser(req: Request, res: Response): Promise<void> {
  //   try {
  //     const { verificationToken } = req.body;

  //     const { data, error } = await supabase
  //       .from("user")
  //       .select("email")
  //       .eq("verification_token", verificationToken)
  //       .maybeSingle();

  //     if (error) {
  //       return res.status(500).json({ error: error.message });
  //     }

  //     return res.status(200).json({ message: "Email Successfully Verified. You may now proceed to creating Your New Profile." });
  //   } catch (error) {
  //     res.status(500).json({
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     });
  //   }
  // }

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
        res.status(200).json({ user: userData, tasker: taskerData });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
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
      const userId = Number(req.params.id); // Ensure ID is from params
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
      const imageFile = req.file;

      // Check if email already exists for another user
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
        birthdate
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

    // Ensure email uniqueness check
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

    // File upload handling
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

    // Update user details
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

    // Update tasker documents if PDF is uploaded
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


// This is for the tasker profile update with both profile and PDF image
// Tasker profile update with profile image & PDF document


static async updateTaskerWithFileandImage(req: Request, res: Response): Promise<any> {
  try {
    const userId = Number(req.params.id);
    const {
      first_name, middle_name, last_name, email, user_role, contact, gender, birthdate,
      specialization_id, bio, skills, wage_per_hour, pay_period
    } = req.body;

    console.log("Received Data:", req.body);

    // Ensure email uniqueness check
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

    // File upload handling
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

    // Update user details
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

    // Update tasker documents if PDF is uploaded
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

    // Ensure email uniqueness check
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

    // File upload handling
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

    // Update user details
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


































// updating client with both profile and ID images
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

      // Check if email already exists for another user
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

      // Handle file uploads (profileImage and idImage)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let profileImageUrl = "";
      let idImageUrl = "";

      // Process profile image if it exists
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

      // Process ID image if it exists
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

      // id image url if they exist 
        idImageUrl = publicUrlData?.publicUrl || "";
      }


      console.log("Profile Image URL:", profileImageUrl);
      console.log("ID Image URL:", idImageUrl);
      

      // Prepare update data
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

      // Add image URLs if they exist
      if (profileImageUrl) {
        updateData.image_link = profileImageUrl;
      }

      // Update user data
      const { data, error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // If ID image was uploaded, store it in a separate table or update the existing record
      if (idImageUrl) {
        // Check if user already has an ID image record
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
          // Update existing record
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
          // Create new record
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

// updating client with profile image only
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
      } = req.body;

      // Check if email already exists for another user
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

      // Handle file uploads (profileImage and idImage)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let profileImageUrl = "";

      // Process profile image if it exists
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
      

      // Prepare update data
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

      // Add image URLs if they exist
      if (profileImageUrl) {
        updateData.image_link = profileImageUrl;
      }

      // Update user data
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
      console.error("Error in updateUserWithImages:", error);
      return res.status(500).json({ error: error.message || "An error occurred while updating user" });
    }
  }


// updating client with ID image only
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

      // Check if email already exists for another user
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

      // Handle file uploads (profileImage and idImage)
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
      let idImageUrl = "";

      // Process ID image if it exists
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

      // id image url if they exist 
        idImageUrl = publicUrlData?.publicUrl || "";
      }

      console.log("ID Image URL:", idImageUrl);
      

      // Prepare update data
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


      // Update user data
      const { data, error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      // If ID image was uploaded, store it in a separate table or update the existing record
      if (idImageUrl) {
        // Check if user already has an ID image record
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
          // Update existing record
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
          // Create new record
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
