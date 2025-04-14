import { Request, Response } from "express";
import TaskerModel from "../models/taskerModel";
import ClientModel from "../models/clientModel";
import { supabase } from "../config/configuration";
import { UserAccount } from "../models/userAccountModel";
import FeedbackModel from "../models/feedbackModel";

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
      //   profile_picture: profilePicUrl,
      // Create tasker profile
      await TaskerModel.createTasker({
        address,
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
  //  profile_picture
      await TaskerModel.update(
        {
          tasker_id, address,
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
        user_id, tasker_id, first_name, middle_name, last_name, email, role, gender,
        contact, birthdate, bio, specialization_id, skills, group,pay_period,
        availability, wage_per_hour, street_address, barangay, city,
        province, postal_code, country, social_media_links, tesda_document_link,
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
          .upload(fileName, new Blob([pdfFile.buffer]), {
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
        first_name, middle_name, last_name, email, role, contact,
        gender, birthdate, image_link: profileImageUrl
      };

      const address = {
        street_address, barangay, city, province, postal_code, country
      };
  
      const updateSkills = { specialization_id, bio, skills, wage_per_hour, pay_period, updated_at: new Date(), group, availability, address };
  
      // Update user details
      const { error: updateUserError } = await supabase
        .from("user")
        .update(updateUser)
        .eq("user_id", user_id);
  
      if (updateUserError) {
        console.error("Error updating user table:", updateUserError);

        return res.status(500).json({ error: updateUserError.message });
      }

      const { data: existingTasker } = await supabase
        .from("tasker")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (!existingTasker) {
        const { error: insertTaskerError } = await supabase
          .from("tasker")
          .insert({
            user_id,
            tasker_id,
            specialization_id,
            bio,
            skills,
            wage_per_hour,
            pay_period,
            group,
            availability,
            address,
            created_at: new Date(),
            updated_at: new Date()
          });
  
        if (insertTaskerError) {
          console.error("Error inserting into tasker table:", insertTaskerError);
          return res.status(500).json({ error: insertTaskerError.message });
        }
      } else {
        const { error: updateTaskerError } = await supabase
          .from("tasker")
          .update(updateSkills)
          .eq("user_id", user_id);
  
        if (updateTaskerError) {
          console.error("Error updating tasker table:", updateTaskerError);
          return res.status(500).json({ error: updateTaskerError.message });
        }
      }

      // Update tasker details
  
      const { error: updateSkillsError } = await supabase
        .from("tasker")
        .update(updateSkills)
        .eq("user_id", user_id);
  
      if (updateSkillsError) {
        console.error("Error updating tasker table:", updateSkillsError);
        return res.status(500).json({ error: updateSkillsError.message });
      }
  
      // Update tasker documents if PDF is uploaded
      const { data: existingDocument } = await supabase
        .from("tasker_documents")
        .select("tasker_id")
        .eq("tasker_id", user_id)
        .maybeSingle();
  
      if (existingDocument) {
        const { error: pdfUpdateError } = await supabase
          .from("tasker_documents")
          .update({
            tesda_document_link: pdfUrl,
            valid: false,
            updated_at: new Date()
          })
          .eq("tasker_id", user_id);
  
        if (pdfUpdateError) {
          console.error("Error updating tasker_documents table:", pdfUpdateError);
          return res.status(500).json({ error: pdfUpdateError.message });
        }
      } else {
        const { error: insertError } = await supabase
          .from("tasker_documents")
          .insert({
            tasker_id: user_id,
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
      console.error("Error in updateTaskerLogin:", error instanceof Error ? error.message : "Unknown error");
      console.error("Stack trace:", error instanceof Error ? error.stack : "No stack available");
      res.status(500).json({ error: "An error occurred while updating tasker information. Please try again." });
    }
  }

  /**
   * Rate the tasker by client
   * @param req
   * @param res
   * @return
   * @throws
   */
  static async postClientFeedbacktoTasker(req: Request, res: Response): Promise<void> {
    try {
      const { tasker_id, task_taken_id, rating, feedback } = req.body;
      console.log(req.body)

      await FeedbackModel.createFeedback({
        tasker_id: tasker_id,
        task_taken_id: task_taken_id,
        feedback,
        rating: parseInt(rating),
      });

      res.status(200).json({ message: "Feedback posted successfully"});
    } catch (error) {
      console.error("Error in postClientFeedbacktoTasker:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "An Error Occurred while Posting Feedback" });
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