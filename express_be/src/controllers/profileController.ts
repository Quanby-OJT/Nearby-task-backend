import { Request, Response } from "express";
import ClientModel from "../models/clientModel";
import { supabase } from "../config/configuration";
import { UserAccount } from "../models/userAccountModel";

class TaskerController {
  static async createTasker(req: Request, res: Response): Promise<any> {
    try {
      console.log("Request body:", req.body);
      const {
        address,
        user_id,
        bio,
        specialization,
        skills,
        availability,
        wage_per_hour,
        pay_period,
        social_media_links,
        gender,
        contact_number,
        birth_date,
        group
      } = req.body;


      console.log("Request body:", req.body);

      const { data: specializations, error: specialization_error } = await supabase
        .from("tasker_specialization")
        .select("spec_id")
        .eq("specialization", specialization)
        .single();

      if (specialization_error) throw new Error("Specialization Error: " + specialization_error.message);

      // Validate file uploads
      if (!req.files) {
        throw new Error("Missing required files (image and/or document)");
      }
      const { image, document } = req.files as {
        image: Express.Multer.File[],
        document: Express.Multer.File[]
      };

      console.log(image, document);

      // Upload profile picture
      const profileImagePath = `profile_pictures/${user_id}_${Date.now()}_${image[0].originalname}`;
      const { error: profilePicError } = await supabase.storage
        .from("documents")
        .upload(profileImagePath, image[0].buffer, {
          contentType: image[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (profilePicError) throw new Error("Error uploading profile picture: " + profilePicError.message);

      // Upload TESDA document
      const documentPath = `tesda_documents/${user_id}_${Date.now()}_${document[0].originalname}`;
      const { error: tesdaDocError } = await supabase.storage
        .from("documents")
        .upload(documentPath, document[0].buffer, {
          contentType: document[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (tesdaDocError) throw new Error("Error uploading TESDA document: " + tesdaDocError.message);

      // Get public URLs
      const profilePicUrl = supabase.storage
        .from("documents")
        .getPublicUrl(profileImagePath).data.publicUrl;

      const tesdaDocUrl = supabase.storage
        .from("documents")
        .getPublicUrl(documentPath).data.publicUrl;

      // Store TESDA document reference
      const { data: tesda_documents, error: tesda_error } = await supabase
        .from("tasker_documents")
        .insert({ tesda_document_link: tesdaDocUrl })
        .select("id")
        .single();

      if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);

      await UserAccount.uploadImageLink(user_id, profilePicUrl);
      
      // Save bio and social_media_links to user_verify table only (unified approach)
      const verifyData: any = { user_id: parseInt(user_id) };
      if (bio) verifyData.bio = bio;
      if (social_media_links) verifyData.social_media_links = social_media_links;
      verifyData.updated_at = new Date().toISOString();
      
      const { error: verifyError } = await supabase
        .from('user_verify')
        .upsert(verifyData);
        
      if (verifyError) {
        console.warn("Could not update user_verify table:", verifyError);
        // Don't fail the entire operation, just log the warning
      }

      // Save document URL to user_documents table if document was uploaded
      if (tesdaDocUrl) {
        const documentData = {
          tasker_id: user_id, // Note: keeping tasker_id for compatibility with existing schema
          user_document_link: tesdaDocUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: docError } = await supabase
          .from('user_documents')
          .upsert(documentData);
          
        if (docError) {
          console.warn("Could not update user_documents table:", docError);
          // Don't fail the entire operation, just log the warning
        }
      }

      res.status(201).json({ taskerStatus: true });
    } catch (error) {
      console.error("Error in createTasker:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error in createTasker:", error instanceof Error ? error.stack : "Internal Server Error");
      res.status(500).json({
        error: "An Error Occurred while Creating Tasker. Please Try Again.",
      });
    }
  }

  /**
   * Update Tasker Information
   * @param req
   * @param res
   * @returns
   * @throws
   */
  static async updateTasker(req: Request, res: Response): Promise<void> {
    try {
      const {
        user_id, first_name, middle_name, last_name, email, password, gender,
        contact_number, address, birth_date, bio, specialization, skills,
        availability, wage_per_hour, profile_picture, tesda_document_link, social_media_links
      } = req.body;
  
      console.log(req.body);
  
      const files = req.files as { [key: string]: Express.Multer.File[] };
      const image = files['image'];
      const documents = files['documents'];
  
      if ((!documents || documents.length === 0) && tesda_document_link === null) {
        res.status(413).json({ error: "Please Upload your Credentials." });
        return;
      }
  
      if (!image || image.length === 0) {
        res.status(413).json({ error: "No profile image uploaded" });
        return;
      }
  
      // Upload profile picture
      const profileImagePath = `profile_pictures/${user_id}_${Date.now()}_${image[0].originalname}`;
      const { error: profilePicError } = await supabase.storage
        .from("documents")
        .upload(profileImagePath, image[0].buffer, {
          contentType: image[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });
  
      if (profilePicError) {
        res.status(413).json({ error: "Error uploading profile picture: " + profilePicError.message });
        return;
      }
  
      // Upload TESDA document
      let tesdaDocUrl = tesda_document_link;
      if (documents && documents.length > 0) {
        const tesdaDocPath = `tesda_documents/${user_id}_${Date.now()}_${documents[0].originalname}`;
        const { error: tesdaDocError } = await supabase.storage
          .from("documents")
          .upload(tesdaDocPath, documents[0].buffer, {
            contentType: documents[0].mimetype,
            cacheControl: "3600",
            upsert: true,
          });
  
        if (tesdaDocError) {
          res.status(413).json({ error: "Error uploading TESDA document: " + tesdaDocError.message });
          return;
        }
  
        tesdaDocUrl = supabase.storage.from("documents").getPublicUrl(tesdaDocPath).data.publicUrl;
      }
  
      const profilePicUrl = supabase.storage.from("documents").getPublicUrl(profileImagePath).data.publicUrl;
  
      // Update user table
      const { error: updateUserError } = await supabase
        .from("user")
        .update({
          first_name,
          middle_name,
          last_name,
          email,
          contact: contact_number,
          gender,
          birthdate: birth_date,
          image_link: profilePicUrl
        })
        .eq("user_id", user_id);
  
      if (updateUserError) {
        res.status(500).json({ error: "Error updating user: " + updateUserError.message });
        return;
      }

      // Save bio and social_media_links to user_verify table only
      const verifyData: any = { user_id: parseInt(user_id) };
      if (bio) verifyData.bio = bio;
      if (social_media_links) verifyData.social_media_links = social_media_links;
      verifyData.updated_at = new Date().toISOString();
      
      const { error: verifyError } = await supabase
        .from('user_verify')
        .upsert(verifyData);
        
      if (verifyError) {
        console.warn("Could not update user_verify table:", verifyError);
        // Don't fail the entire operation, just log the warning
      }

      // Save document URL to user_documents table if document was uploaded
      if (tesdaDocUrl) {
        const documentData = {
          tasker_id: user_id, // Note: keeping tasker_id column name for compatibility
          user_document_link: tesdaDocUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: docError } = await supabase
          .from('user_documents')
          .upsert(documentData);
          
        if (docError) {
          console.warn("Could not update user_documents table:", docError);
          // Don't fail the entire operation, just log the warning
        }
      }
  
      res.status(200).json({ message: "User Information Updated Successfully" });
    } catch (error) {
      console.error("Error in updateTasker:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error in updateTasker:", error instanceof Error ? error.stack : "Internal Server Error");
      res.status(500).json({
        error: "An Error Occurred while Updating User. Please try again.",
      });
    }
  }


  /**
   * Update Tasker Information
   * @param req
   * @param res
   * @returns
   * @throws
   */
  static async updateTaskerLogin(req: Request, res: Response): Promise<any> {
    try {
      const {
        user_id, first_name, middle_name, last_name, email, role, gender,
        contact, birthdate, bio, social_media_links,
      } = req.body;
  
      console.log("Received Data:", req.body);

      // Ensure email uniqueness check
      const { data: existingUser, error: findError } = await supabase
        .from("user")
        .select("email, user_id")
        .eq("email", email)
        .neq("user_id", user_id)
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
  
      if (files && files.documents && files.documents.length > 0) {
        const pdfFile = files.documents[0];
        const fileName = `users/pdf_${user_id}_${Date.now()}_${pdfFile.originalname}.pdf`;
  
        console.log("Uploading PDF File:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, pdfFile.buffer, {
            contentType: pdfFile.mimetype,
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
        const fileName = `users/profile_${user_id}_${Date.now()}_${profileImageFile.originalname}`;
  
        console.log("Uploading Profile Image:", fileName);
        
        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, profileImageFile.buffer, {
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
        first_name, 
        middle_name, 
        last_name, 
        email, 
        user_role: role, 
        contact,
        gender, 
        birthdate, 
        image_link: profileImageUrl
      };
  
      // Update user details
      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", user_id);
  
      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);
        return res.status(500).json({ error: updateUserError.message });
      }

      // Save bio and social_media_links to user_verify table only
      const verifyData: any = { user_id: parseInt(user_id) };
      if (bio) verifyData.bio = bio;
      if (social_media_links) verifyData.social_media_links = social_media_links;
      verifyData.updated_at = new Date().toISOString();
      
      const { error: verifyError } = await supabase
        .from('user_verify')
        .upsert(verifyData);
        
      if (verifyError) {
        console.warn("Could not update user_verify table:", verifyError);
        // Don't fail the entire operation, just log the warning
      }

      // Save document URL to user_documents table if PDF was uploaded
      if (pdfUrl) {
        const documentData = {
          tasker_id: user_id, // Note: keeping tasker_id column name for compatibility
          user_document_link: pdfUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: docError } = await supabase
          .from('user_documents')
          .upsert(documentData);
          
        if (docError) {
          console.warn("Could not update user_documents table:", docError);
          // Don't fail the entire operation, just log the warning
        }
      }
  
      return res.status(200).json({
        message: "User updated successfully",
        profileImageUrl,
        pdfUrl,
      });
      
    } catch (error) {
      console.error("Error in updateTaskerLogin:", error instanceof Error ? error.message : "Unknown error");
      console.error("Stack trace:", error instanceof Error ? error.stack : "No stack available");
      res.status(500).json({ error: "An error occurred while updating user information. Please try again." });
    }
  }
}


class ClientController {
  static async createClient(req: Request, res: Response): Promise<any> {
    try {
      const { user_id, preferences, client_address } = req.body;

      await ClientModel.createNewClient({
        user_id,
        preferences,
        client_address,
      });

      res.status(201).json({ message: "Successfully created new profile." });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, preferences, client_address } = req.body;

      await ClientModel.updateClient({
        user_id,
        preferences,
        client_address,
      });

      res.status(200).json({ message: "Client profile updated successfully." });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Unknown error")
      res.status(500).json({
        error: "An Error occured while updating your information. Please Try Again.",
      });
    }
  }
}

export default { TaskerController, ClientController };