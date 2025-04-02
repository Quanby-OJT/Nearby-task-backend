import { Request, Response } from "express";
import TaskerModel from "../models/taskerModel";
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
        social_media_links,
      } = req.body;

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

      // Create tasker profile
      await TaskerModel.createTasker({
        address,
        profile_picture: profilePicUrl,
        user_id,
        bio,
        specialization_id: specializations.spec_id,
        skills,
        availability: availability === 'true',
        wage_per_hour: parseFloat(wage_per_hour),
        tesda_documents_id: tesda_documents.id,
        social_media_links: social_media_links
      });

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
        user_id, tasker_id, first_name, middle_name, last_name, email, password, gender,
        contact_number, address, birth_date, bio, specialization, skills,
        availability, wage_per_hour, profile_picture, tesda_document_link, social_media_links
      } = req.body;
  
      console.log(req.body);
  
      // This is unecessary.
      // // Validate file uploads
      // if (!req.files) {
      //   res.status(413).json({ error: "Missing required files (image and/or document)" });
      //   return;
      // }
  
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
        res.status(500).json({ error: "Error uploading profile picture: " + profilePicError.message });
        return;
      }
  
      // Upload TESDA document
      let tesdaDocUrl = tesda_document_link;
      if(tesda_document_link === null && documents.length > 0) {      
        const documentPath = `tesda_documents/${user_id}_${Date.now()}_${documents[0].originalname}`;
        const { error: tesdaDocError } = await supabase.storage
          .from("documents")
          .upload(documentPath, documents[0].buffer, {
            contentType: documents[0].mimetype,
            cacheControl: "3600",
            upsert: true,
          });
    
        if (tesdaDocError) {
          res.status(500).json({ error: "An Error occurred while uploading your files. Please try again." });
          return;
        }

        tesdaDocUrl = supabase.storage
        .from("documents")
        .getPublicUrl(documentPath).data.publicUrl;
      }

      // Get public URLs
      const profilePicUrl = supabase.storage
        .from("documents")
        .getPublicUrl(profileImagePath).data.publicUrl;
  

  
      // Store TESDA document reference
      const { data: tesda_documents, error: tesda_error } = await supabase
        .from("tasker_documents")
        .insert({ tesda_document_link: tesdaDocUrl })
        .select("id")
        .single();
  
      if (tesda_error) {
        res.status(500).json({ error: "Error storing document reference: " + tesda_error.message });
        return;
      }

      // Parse social_media_links safely
    let jsonedSocMed;
    try {
      jsonedSocMed = JSON.parse(social_media_links);
      // Ensure it's an object (not a string or array)
      if (typeof jsonedSocMed !== 'object' || jsonedSocMed === null || Array.isArray(jsonedSocMed)) {
        throw new Error("social_media_links must be a JSON object");
      }
    } catch (parseError) {
      console.error("Failed to parse social_media_links:", social_media_links, parseError);
      res.status(400).json({ error: "Invalid social_media_links format. Must be a valid JSON object." });
      return;
    }
  
      await UserAccount.uploadImageLink(user_id, profilePicUrl);
  
      await TaskerModel.update(
        {
          tasker_id, address, profile_picture,
          bio, skills, availability, wage_per_hour, social_media_links: jsonedSocMed,
        },
        { specialization, tesda_documents_link: tesda_document_link },
        { user_id, first_name, middle_name, last_name, email, password }
      );
  
      res.status(200).json({ message: "Tasker Information Updated Successfully" });
    } catch (error) {
      console.error("Error in updateTasker:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error in updateTasker:", error instanceof Error ? error.stack : "Internal Server Error");
      res.status(500).json({
        error: "An Error Occurred while Updating Tasker. Please try again.",
      });
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