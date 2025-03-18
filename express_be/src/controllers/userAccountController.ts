import { supabase } from "./../config/configuration";
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
import taskerModel from "../models/taskerModel";
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
        email,
        password,
        user_role
      } = req.body;

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

      // Insert user into Supabase database
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

  static async createTasker(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const {
        gender,
        contact_number,
        address,
        birthdate,
        profile_picture,
        user_id,
        bio,
        specialization,
        skills,
        availability,
        wage_per_hour,
        tesda_documents_link,
        social_media_links,
      } = req.body;

      const newTask = await taskerModel.createTasker(
        gender,
        contact_number,
        address,
        birthdate,
        profile_picture,
        user_id,
        bio,
        specialization,
        skills,
        availability,
        wage_per_hour,
        tesda_documents_link,
        social_media_links
      );

      res
        .status(201)
        .json({ message: "Task created successfully", task: newTask });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
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

  static async getUserData(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.id;
      console.log("Retrieving User Data for..." + userID);

      const userData = await UserAccount.showUser(userID);

      if (userData.user_role === "Client") {
        const clientData = await UserAccount.showClient(userID);
        console.log("Your role is: " + clientData);
        res.status(200).json({ user: userData, client: clientData });
      } else if (userData.user_role === "Tasker") {
        const taskerData = await UserAccount.showTasker(userID);
        console.log("Your role is: " + taskerData);
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
      const userId = Number(req.params.id);
      const {
        first_name,
        middle_name,
        last_name,
        birthday,
        email,
        acc_status,
        user_role,
      } = req.body;
      const imageFile = req.file;

      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", userId)
        .maybeSingle();

      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      if (findError && findError.message !== "No rows found") {
        throw new Error(findError.message);
      }

      let imageUrl = "";
      if (imageFile) {
        const { data, error } = await supabase.storage
          .from("crud_bucket")
          .upload(
            `users/${Date.now()}_${imageFile.originalname}`,
            imageFile.buffer,
            {
              cacheControl: "3600",
              upsert: false,
            }
          );

        if (error) throw new Error(error.message);

        const { data: publicUrlData } = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(data.path);

        imageUrl = publicUrlData.publicUrl;
      }

      const updateData: Record<string, any> = {
        first_name,
        middle_name,
        last_name,
        birthdate: birthday,
        email,
        acc_status,
        user_role,
      };

      if (imageFile) {
        updateData.image_link = imageUrl;
      }

      const { error } = await supabase
        .from("user")
        .update(updateData)
        .eq("user_id", userId);

      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ message: "User updated successfully" });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
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
}

export default UserAccountController;
