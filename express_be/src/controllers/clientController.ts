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

  static async getAllClientsBySpecialization(req: Request, res: Response): Promise<void> {
    const specialization = req.query.specialization as string | undefined;
    console.log('Specialization:', specialization);

    let specializationId: number | null = null;
    if (specialization && specialization !== 'All') {
      const { data: specializationData, error: specializationError } = await supabase
        .from('tasker_specialization')
        .select('spec_id, specialization')
        .eq('specialization', specialization)
        .single();

      if (specializationError || !specializationData) {
        console.error('Supabase fetch specialization error:', specializationError);
        throw new Error(specializationError?.message || 'Specialization not found');
      }

      console.log("Fetched specialization ID:", specializationData.spec_id);
      console.log("Fetched specialization name:", specializationData.specialization);
      specializationId = specializationData.spec_id;
    }



    try {
      const { data, error } = await supabase
      .from('tasker').select(`
        tasker_id,
        user_id,
        specialization_id,
        bio,
        skills,
        availability,
        social_media_links,
        address,
        wage_per_hour,
        pay_period,
        group,
        rating,
        user!inner (
          user_id,
          first_name,
          middle_name,
          last_name,
          image_link,
          birthdate,
          acc_status,
          gender,
          email,
          contact,
          verified,
          user_role
        ),
        tasker_specialization (
          specialization
        )
      `)
      .not('user', 'is', null)
      .eq('user.acc_status', 'Active')
      .eq('user.verified', true)
      .eq('user.user_role', 'Tasker')
      .eq('specialization_id', specializationId);
  
      console.log("Taskers data:", data, "Error:", error);
  
      if (error) {
        console.error("Error fetching taskers:", error.message);
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }
  
      if (!data || data.length === 0) {
        res.status(200).json({ error: "No active taskers found." });
        return;
      }
  
      res.status(200).json({ taskers: data });
    } catch (error) {
      console.error("Error fetching taskers:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  static async getMyDataTasker(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId;

    try {
      const { data, error } = await supabase
        .from("tasker")
        .select(
          `
        *,
        user!inner (
          user_id,
          first_name,
          middle_name,
          last_name,
          image_link,
          birthdate,
          acc_status,
          gender,
          email,
          contact,
          verified,
          user_role,
          user_preference!inner(*, address(*))
        ) 
      `
        )
        .eq("user.user_id", userId)
        .maybeSingle();
      
      console.log("User ID:", userId);

      console.log("Client data:", data, "Error:", error);

      if (error) {
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      if (!data) {
        res.status(400).json({ error: "No active client found." });
        return;
      }

      res.status(200).json({ client: data });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  static async getAllFilteredTaskers(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("tasker")
        .select(
          `
          *,
          tasker_specialization (
            specialization
          ),
          user!inner (
            user_id,
            first_name,
            middle_name,
            last_name,
            image_link,
            birthdate,
            acc_status,
            gender,
            email,
            contact,
            verified,
            user_role,
            user_preference!inner(*, address(*))
          ) 
        `
        )
        .not("user", "is", null)
        .eq("user.acc_status", "Active")
        .eq("user.verified", true)
        .eq("user.user_role", "Tasker");

      console.log("Taskers data:", data, "Error:", error);

      if (error) {
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      if (!data || data.length === 0) {
        res.status(200).json({ error: "No active taskers found." });
        return;
      }

      res.status(200).json({ taskers: data });
    } catch (error) {
      console.error("Error fetching taskers:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }


  static async getMyDataClient(req: Request, res: Response): Promise<void> {
    const userId = req.params.userId;

    try {
      const { data, error } = await supabase
        .from("clients")
        .select(
          `
        *,
        user!inner (
          user_id,
          first_name,
          middle_name,
          last_name,
          image_link,
          birthdate,
          acc_status,
          gender,
          email,
          contact,
          verified,
          user_role,
          user_preference!inner(*, address(*))
        ) 
      `
        )
        .eq("user.user_id", userId)
        .maybeSingle();
      
      console.log("User ID:", userId);

      console.log("Client data:", data, "Error:", error);

      if (error) {
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      if (!data) {
        res.status(400).json({ error: "No active client found." });
        return;
      }

      res.status(200).json({ client: data });
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  static async getAllClients(req: Request, res: Response): Promise<void> {
    console.log("Fetching all desired Taskers...");
    try {
      const { data, error } = await supabase
        .from("tasker")
        .select(`
          *,
          tasker_specialization (
        specialization
          ),
          user!inner (
            user_id,
            first_name,
            middle_name,
            last_name,
            image_link,
            birthdate,
            acc_status,
            gender,
            email,
            contact,
            verified,
            user_role
          )
        `)
        .not('user', 'is', null)
        .eq('user.acc_status', 'Active')
        .eq('user.verified', true)
        .eq('user.user_role', 'Tasker')
  
      console.log("Taskers data:", data, "Error:", error);
  
      if (error) {
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }
  
      if (!data || data.length === 0) {
        res.status(200).json({ error: "No active taskers found." });
        return;
      }
  
      res.status(200).json({ taskers: data });
    } catch (error) {
      console.error("Error fetching taskers:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
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
      .rpc('increment_client_credits', { addl_credits: amount, id: clientId});

      console.log("add credits to client: " + data, error);
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
  // static async getActiveTaskers() {
  //   const { data, error } = await supabase
  //     .from("users")
  //     .select("*")
  //     .eq("users.role", "tasker")
  //     .eq("users.acc_status", "active");
  //   if (error) throw new Error(error.message);

  //   return data;
  // }

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
      if (client_id == 0 || tasker_id == 0) {
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
