import { supabase } from "../config/configuration";
import { Request, Response } from "express";
import { AuthorityAccount } from "../models/authorityAccountModel";
import bcrypt from "bcrypt";

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
        birthdate: birthday,
        email,
        user_role,
        contact,
        gender,
        image_link: imageUrl,
        acc_status: acc_status || "Active", // Default to Active if not provided
        emailVerified: true, // No email verification needed
        verification_token: null, // No token since no verification
      };

      // Hash the password if provided
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
}

export default AuthorityAccountController;