// controllers/userController.ts
import { Request, Response } from "express";
import { UserAccount } from "../models/userAccountModel";
import bcrypt from "bcrypt";
import taskerModel from "../models/taskerModel";
import { mailer, supabase } from "../config/configuration";
import crypto from "crypto";
import { randomUUID } from "crypto";
import {Auth} from "../models/authenticationModel";

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
      console.log("Received insert data:", req.body);

      // check if the email exists
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

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      let imageUrl = "";
      if (imageFile) {
        // Upload image to Supabase Storage (crud_bucket)
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

      const unique_token = crypto.randomBytes(32).toString("hex"); 

      // Insert user into Supabase database
      await UserAccount.create({
        first_name,
        middle_name,
        last_name,
        birthdate: birthday,
        email,
        image_link: imageUrl,
        hashed_password: hashedPassword,
        acc_status,
        user_role,
        verification_token: unique_token,
      });

      const verificationLink = `myapp://verify?token=${unique_token}&email=${email}`
      const webLink = `http://localhost:5000/connect/verify?token=${unique_token}&email=${email}`

      
      const otpHtml = `
        <div class="bg-gray-100 p-6 rounded-lg shadow-lg">
          <h2 class="text-xl font-bold text-gray-800">You are ONE SWIPE away from getting a new Job.</h2>
          <p class="text-gray-700 mt-4">Hello. I'm Juan, and I am so excited to introduce you to the world of NearByTask - getting a new task/tasker is as easy as right-swiping away your favorite tasks. If you are a client, you can swipe away your favorite tasker. To Start, we need to verify your email to ensure that you are a real human.</p>
          <div class="mt-4 text-center">
            Click <a href=${verificationLink} class="text-3xl font-bold text-blue-600">here</a> to verify your email. Or if you can't click the link, you can use the alternative: <a href="${webLink}">Alternative Link.</a>
          </div><br>
          <p class="text-red-500 mt-4">See you on the other side.</p>
          <p class="text-gray-500 mt-6 text-sm">Best Regards:</p>
          <p class="text-gray-500 mt-6 text-sm">Juan</p>
        </div>`;

      const sent = await mailer.sendMail({
        from: "noreply@nearbytask.com",
        to: email,
        subject: "Welcome to NearByTask - ONE SWIPE away from getting a new Job",
        html: otpHtml,
      });

      console.log(sent);

      res.status(201).json({
        message: "Successfully Created a new Account. Please check your email for verification.",
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  }

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token, email } = req.body;
      console.log(req.body)

      const verifyToken = await UserAccount.getUser(email)

      if(verifyToken.verification_token != token)
      {
        res.status(401).json({error: "Sorry. Your Email Token has been Expired."})
      }

      const userId = await UserAccount.resetEmailToken(email)

      const sessionToken = randomUUID();

      const userLogin = await Auth.insertLogData(userId.user_id, sessionToken);

      res.cookie("session", userLogin.session, {
        httpOnly: true,
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      });

      //res.redirect(`myapp://verify?token=${token}&email=${email}`)
      res.status(200).json({message: "Successfully Verified Email.", user_id: userId.user_id, session: sessionToken})
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
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

  static async getUserData(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.id;
      console.log("Retrieving User Data for..." + userID);

      const userData = await UserAccount.showUser(userID);

      if (userData.user_role === "Client") {
        const clientData = await UserAccount.showClient(userID);
        console.log(clientData);
        res.status(200).json({ user: userData, client: clientData });
      } else if (userData.user_role === "Tasker") {
        const taskerData = await UserAccount.showTasker(userID);
        console.log(taskerData);
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
