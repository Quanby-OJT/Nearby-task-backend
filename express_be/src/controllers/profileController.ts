import { Request, Response } from "express";
import TaskerModel from "../models/taskerModel";
import ClientModel from "../models/clientModel";
import { supabase } from "../config/configuration";

class TaskerController {
  static async createTasker(req: Request, res: Response): Promise<any> {
    try {
      const {
        user_id,
        group,
        bio,
        specialization,
        skills,
        availability,
        tesda_documents_link,
        social_media_links,
      } = req.body;
      let tasker_group = false;

      if (group == "Group Tasker") {
        tasker_group = true;
      } else if (group == "Solo Tasker") {
        tasker_group = false;
      }

      const { data: document, error: document_error } = await supabase
        .from("tasker_documents")
        .insert({ documents_link_pdf: tesda_documents_link, user_id: user_id })
        .select("id")
        .single();
      if (document_error) {
        throw document_error;
      }
      const document_id = document.id;

      const { data: specializations, error: spec_error } = await supabase
        .from("tasker_specialization")
        .select("specialization_id")
        .eq("specialization", specialization)
        .single();
      if (spec_error) throw new Error(spec_error.message);

      const specialization_id = specializations.specialization_id;

      await TaskerModel.createTasker(
        user_id,
        tasker_group,
        bio,
        specialization_id,
        skills,
        availability,
        availability,
        availability,
        availability,
        availability,
        availability,
        document_id,
        social_media_links
      );

      res.status(200).json({ message: "Successfully created new profile." });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
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
}

export default { TaskerController, ClientController };
