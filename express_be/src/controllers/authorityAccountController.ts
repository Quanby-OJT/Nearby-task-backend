import { supabase } from "../config/configuration";
import { Request, Response } from "express";
import { AuthorityAccount } from "../models/authorityAccountModel";
import bcrypt from "bcrypt";
import path from "path"; 

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
}

export default AuthorityAccountController;