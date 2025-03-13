// controllers/userController.ts
import { Request, Response } from "express";
// import { User } from "../models/authenticationModel";
import bcrypt from "bcrypt";
import { supabase } from "../config/configuration";
class UserController {
  // static async registerUser(req: Request, res: Response): Promise<void> {
  //   try {
  //     console.log("Received insert data:", req.body);
  //     const { first_name, last_name, email } = req.body;
  //     const imageFile = req.file;

  //     // Hash password
  //     const hashedPassword = await bcrypt.hash(last_name, 10);

  //     let imageUrl = "";
  //     if (imageFile) {
  //       // Upload image to Supabase Storage (crud_bucket)
  //       const { data, error } = await supabase.storage
  //         .from("crud_bucket")
  //         .upload(
  //           `users/${Date.now()}_${imageFile.originalname}`,
  //           imageFile.buffer,
  //           {
  //             cacheControl: "3600",
  //             upsert: false,
  //           }
  //         );

  //       if (error) throw new Error(error.message);

  //       const { data: publicUrlData } = supabase.storage
  //         .from("crud_bucket")
  //         .getPublicUrl(data.path);

  //       imageUrl = publicUrlData.publicUrl;
  //     }

  //    // Insert user into Supabase database
  //     // const newUser = await User.create({
  //     //   first_name,
  //     //   last_name,
  //     //   email,
  //     //   hashed_password: hashedPassword,
  //     //   image_link: imageUrl,
  //     // });

  //     res
  //       .status(201)
  //       .json({ message: "User registered successfully!", user: newUser });
  //   } catch (error) {
  //     res.status(500).json({
  //       error: error instanceof Error ? error.message : "Unknown error",
  //     });
  //   }
  // }

  static async create(req: Request, res: Response): Promise<void> {}

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
}

export default UserController;
