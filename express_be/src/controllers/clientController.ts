import { Response, Request, NextFunction } from "express";
import { supabase } from "../config/configuration";
import likeModel from "../models/likeModel";
import { console } from "inspector";

class ClientModel {
  static async createNewClient(clientInfo: {
    user_id: number;
    preferences: Text;
    client_address: Text;
  }) {
    const { data, error } = await supabase.from("clients").insert([clientInfo]);
    if (error) throw new Error(error.message);

    return data;
  }

  static async getAllClients(req: Request, res: Response): Promise<any> {
    try {
      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("acc_status", "Active")
        .eq("user_role", "Tasker");

      console.log("fetch all tasker:" + data);

      if (error) {
        return res.status(200).json({ error: error });
      }

      if (!data || data.length === 0) {
        return res.status(200).json({ error: "No active taskers found." });
      }

      return res.status(200).json({ taskers: data });
    } catch (error) {}
  }

  static async updateClient(
    clientId: number,
    clientInfo: { user_id?: number; preferences?: Text; client_address?: Text, amount?: number }
  ) {
    const { data, error } = await supabase
      .from("clients")
      .update(clientInfo)
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return data;
  }

  static async addCredits(clientId: number, amount: number) {

    const { data, error } = await supabase
      .rpc('increment_client_credits', { addl_credits: amount, id: clientId,  });
    if (error) throw new Error(error.message);
    return data;
  }

  static async archiveCLient(clientId: number) {
    const { data, error } = await supabase
      .from("clients")
      .update({ acc_status: "blocked" })
      .eq("id", clientId);
    if (error) throw new Error(error.message);
    return data;
  }

  // fetch data from user where user has role of tasker and acc_status is "Active"
  static async getActiveTaskers() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("users.role", "tasker")
      .eq("users.acc_status", "active");
    if (error) throw new Error(error.message);

    return data;
  }

  static async createLike(req: Request, res: Response) {
    try {
      console.log("Received insert data:", req.body);
      const { user_id, task_post_id } = req.body;

      const client_id = user_id;
      const tasker_id = req.body.task_post_id;

      // Check for missing fields
      if (!client_id || !task_post_id) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const { data: alreadySaved } = await supabase
        .from("saved_tasker")
        .select("*")
        .eq("tasker_id", tasker_id)
        .eq("client_id", client_id)
        .maybeSingle();

      if (alreadySaved) {
        console.log("Task post created" + alreadySaved);
        res
          .status(201)
          .json({ message: "You saved this tasker!", task: alreadySaved });
      }

      const { data, error } = await supabase.from("saved_tasker").insert({
        client_id,
        tasker_id,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        console.log(error);
        return;
      }

      console.log("Task post created" + data);
      res.status(201).json({ message: "You saved this tasker!", task: data });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getLikedTask(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id; // Get userId from URL parameter
      console.log("pass to get the user ID: " + userId);

      // Filter likes by user_id
      const { data, error } = await supabase
        .from("saved_tasker")
        .select("*") // Join with tasks/jobs table if needed
        .eq("client_id", userId);

      console.log("Liked: " + data, "Errors :" + error);

      if (error) {
        console.error("Error fetching liked tasks:", error.message);
        res.status(500).json({
          error:
            "An Error Occured while retrieiving Your liked jobs. Please Try Again.",
        });
      } else {
        res.status(200).json({ liked_tasks: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async deleteLike(req: Request, res: Response): Promise<void> {
    try {
      console.log("Delete like request:", req.body);
      const { client_id, tasker_id } = req.body;

      // Check for missing fields
      if (!client_id || !tasker_id) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      // Delete the like from database
      const { error } = await supabase.from("saved_tasker").delete().match({
        client_id: client_id,
        tasker_id: tasker_id,
      });

      if (error) {
        throw error;
      }

      res.status(200).json({ message: "Like removed successfully" });
    } catch (error) {
      console.error("Error deleting like:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default ClientModel;
