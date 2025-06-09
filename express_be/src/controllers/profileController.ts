import { Request, Response } from "express";
import ClientModel from "../models/clientModel";
import { supabase } from "../config/configuration";
import { UserAccount } from "../models/userAccountModel";
import UploadFile from "../models/fileUploadModel";
import TaskerModel from "../models/taskerModel";

class TaskerController {
  static async createTasker(req: Request, res: Response): Promise<void> {
    try {
      console.log("Request body:", req.body);
      const { address, user_id, bio, specialization, skills, availability, wage_per_hour, pay_period, social_media_links, group} = req.body;


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
      // const { image, document } = req.files as {
      //   image: Express.Multer.File[],
      //   document: Express.Multer.File[]
      // };

      const Documents = (req.files as { [fieldname: string]: Express.Multer.File[] })["user_documents"];
      const Pictures = (req.files as { [fieldname: string]: Express.Multer.File[] })["tasker_image"];
      const name = await UserAccount.showUser(user_id)
      const fullName = name.first_name + " " + name.middle_name + " " + name.last_name
      const imageUrls: string[] = []
      const documentUrls: string[] = []

      // Upload multiple pictures
      if(Pictures && Array.isArray(Pictures)){
        for(const image of Pictures){
          const profileImagePath = `user/images/${fullName}_${Date.now()}_`;
          const imageUrl = await UploadFile.uploadFile(profileImagePath, image)
          imageUrls.push(imageUrl.publicUrl)
        }
      }


      // Upload multiple documents
      if(Documents && Array.isArray(Documents)){
        for(const document of Documents){
          const documentPath = `user/documents/${fullName}_${Date.now()}`;
          const documentUrl = await UploadFile.uploadFile(documentPath, document)
          documentUrls.push(documentUrl.publicUrl)
        }
      }

      // const { error: tesdaDocError } = await supabase.storage
      //   .from("documents")
      //   .upload(documentPath, document[0].buffer, {
      //     contentType: document[0].mimetype,
      //     cacheControl: "3600",
      //     upsert: true,
      //   });

      // if (tesdaDocError) throw new Error("Error uploading TESDA document: " + tesdaDocError.message);

      // Get public URLs
      // const profilePicUrl = supabase.storage
      //   .from("documents")
      //   .getPublicUrl(profileImagePath).data.publicUrl;

      // const tesdaDocUrl = supabase.storage
      //   .from("documents")
      //   .getPublicUrl(documentPath).data.publicUrl;

      // Store TESDA document reference
      // const { data: tesda_documents, error: tesda_error } = await supabase
      //   .from("user_documents")
      //   .insert({ tesda_document_link: tesdaDocUrl })
      //   .select("id")
      //   .single();

      // if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);

      // await UserAccount.uploadImageLink(user_id, profilePicUrl);
      
      // Save bio and social_media_links to user_verify table only (unified approach)
      // const verifyData: any = { user_id: parseInt(user_id) };
      // if (bio) verifyData.bio = bio;
      // if (social_media_links) verifyData.social_media_links = social_media_links;
      // verifyData.updated_at = new Date().toISOString();
      
      // const { error: verifyError } = await supabase
      //   .from('user_verify')
      //   .upsert(verifyData);
        
      // if (verifyError) {
      //   console.warn("Could not update user_verify table:", verifyError);
      //   // Don't fail the entire operation, just log the warning
      // }

      // Save document URL to user_documents table if document was uploaded
      // if (tesdaDocUrl) {
      //   const documentData = {
      //     tasker_id: user_id, // Note: keeping tasker_id for compatibility with existing schema
      //     user_document_link: tesdaDocUrl,
      //     updated_at: new Date().toISOString()
      //   };
        
        // const { error: docError } = await supabase
        //   .from('user_documents')
        //   .upsert(documentData);
          
        // if (docError) {
        //   console.error("Could not update user_documents table:", docError);
        //   // Don't fail the entire operation, just log the warning
        // }
      // }

      await TaskerModel.createTasker(
        user_id,
        bio,
        specializations.spec_id,
        skills,
        availability,
        wage_per_hour,
        pay_period,
        group,
        social_media_links,
        address,
        imageUrls ? imageUrls : []
      )

      if(documentUrls){
        await TaskerModel.uploadTaskerFiles(user_id, documentUrls)
      }

      res.status(201).json({ message: "Tasker Profile Successfully Created." });
    } catch (error) {
      console.error("Error in createTasker:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error in createTasker:", error instanceof Error ? error.stack : "Internal Server Error");
      res.status(500).json({
        error: "An Error Occurred while Creating your tasker profile. Please Try Again.",
      });
    }
  }

  static async getTasker(req: Request, res: Response): Promise<void>{
    try{
      const user_id = parseInt(req.params.id)
      const data = await TaskerModel.getAuthenticatedTasker(user_id)
      res.status(200).json({data})
    }catch(error){
      console.error("Error in getting tasker information: ", error instanceof Error ? error.message : "Unknown Tasker Error")
      res.status(500).json({error: 'An Error occured while retrieving your tasker information. Please Try Again.'})
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
      const taskerData = JSON.parse(req.body.tasker);
      const {
        bio, specialization, skills, availability, social_media_links, 
        address, group, wage: wage_per_hour, pay_period
      } = taskerData;
      const user_id = req.params.id;
  
      console.log("Updating tasker profile with parsed data: ", taskerData);
  
      const { data: specializations, error: specialization_error } = await supabase
        .from("tasker_specialization")
        .select("spec_id")
        .eq("specialization", specialization)
        .single();

      if (specialization_error) throw new Error("Specialization Error: " + specialization_error.message);

      const Documents = (req.files as { [fieldname: string]: Express.Multer.File[] })["user_documents"];
      const Pictures = (req.files as { [fieldname: string]: Express.Multer.File[] })["tasker_images"];

      console.log(Documents, Pictures)

      const name = await UserAccount.showUser(user_id)
      const fullName = name.first_name + " " + name.middle_name + " " + name.last_name
      const imageUrls: string[] = []
      const documentUrls: string[] = []

      // Upload multiple pictures
      if(Pictures && Array.isArray(Pictures)){
        for(const image of Pictures){
          const profileImagePath = `user/images/${fullName}_${Date.now()}_`;
          const imageUrl = await UploadFile.uploadFile(profileImagePath, image)
          imageUrls.push(imageUrl.publicUrl)
        }
      }


      // Upload multiple documents
      if(Documents && Array.isArray(Documents)){
        for(const document of Documents){
          const documentPath = `user/documents/${fullName}_${Date.now()}`;
          const documentUrl = await UploadFile.uploadFile(documentPath, document)
          documentUrls.push(documentUrl.publicUrl)
        }
      }

      await TaskerModel.update(parseInt(user_id), bio, specializations.spec_id, skills, availability, wage_per_hour, pay_period, group, social_media_links, address, imageUrls)
  
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
      const { user_id, preferences, social_media_links } = req.body;

      await ClientModel.createNewClient(
        user_id,
        preferences,
        social_media_links,
      );

      res.status(201).json({ message: "Successfully created new profile." });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getClient(req: Request, res: Response): Promise<any> {
    try {
      const user_id = req.params.id

      console.log("User id: ", user_id)

      const data = await ClientModel.getClientInfo(parseInt(user_id))

      res.status(200).json({ data });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const { preferences, social_media_links } = req.body;
      const user_id = req.params.id

      await ClientModel.updateClient(
        parseInt(user_id),
        preferences,
        social_media_links,
      );

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