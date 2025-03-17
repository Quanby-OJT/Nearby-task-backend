import { Request, Response } from "express";
import TaskerModel from "../models/taskerModel";
import ClientModel from "../models/clientModel";
import { supabase } from "../config/configuration";

class TaskerController {
  static async createTasker(req: Request, res: Response): Promise<any> {
    /**
     * Needs to fix the following:
     * 1. Inserting data to the database
     * 2. Inserting documents to storage.
     * 
     */
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
        tesda_document,
        social_media_links,
      } = req.body;

      const { data: specializations, error: specialization_error } = await supabase.from("tasker_specialization").select("spec_id").eq("specialization", specialization).single();
      if (specialization_error) throw new Error("Specialization Error: " + specialization_error.message);

      //Upload First the TESDA Documents then retrieve the id

      const { data: tesda_documents, error: tesda_error} = await supabase.from("tasker_documents").insert({tesda_document_link: tesda_document}).select("id").single();
      if (tesda_error) console.error(tesda_error.message);
      if (!tesda_documents) throw new Error("Specialization Error: " + "Tesda documents not found");

      await TaskerModel.createTasker({
        gender,
        tasker_is_group: false,
        contact_number,
        address,
        birthdate,
        profile_picture,
        user_id,
        bio,
        specialization_id: specializations.spec_id,
        skills,
        availability,
        wage_per_hour,
        tesda_documents_id: tesda_documents.id,
        social_media_links
      });

      res
        .status(201)
        .json({ taskerStatus: true});
    } catch (error) {
      console.error("Error in createTasker:", error instanceof Error ? error.message : "Internal Server Error");
      res.status(500).json({error: "An Error Occured while Creating Tasker. Please Try Again."});
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
}

export default { TaskerController, ClientController };
