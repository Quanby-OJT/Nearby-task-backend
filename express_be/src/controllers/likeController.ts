import { Request, Response } from "express";

import { supabase } from "../config/configuration";
import likeModel from "../models/likeModel";

class LikeController {
  static async createLike(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const { user_id, job_post_id, created_at} = req.body;

      // Check for missing fields
      if (!user_id || !job_post_id || !created_at) {
        res.status(400).json({ message: "Missing required fields" });
        return;
      }

      // Call the model to insert data into Supabase
      const newTask = await likeModel.create({
        user_id, 
        job_post_id, 
        created_at
      });

      res.status(201).json({ message: "You like this job!", task: newTask });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async getLikedJob(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id; // Get userId from URL parameter
      
      // Filter likes by user_id
      const { data, error } = await supabase
        .from("likes")
        .select("*")  // Join with tasks/jobs table if needed
        .eq("user_id", userId);
    
      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ tasks: data });
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
          const { user_id, job_post_id } = req.body;

          // Check for missing fields
          if (!user_id || !job_post_id) {
              res.status(400).json({ message: "Missing required fields" });
              return;
          }

          // Delete the like from database
          const { error } = await supabase
              .from("likes")
              .delete()
              .match({ 
                  user_id: user_id,
                  job_post_id: job_post_id 
              });

          if (error) {
              throw error;
          }

          res.status(200).json({ message: "Like removed successfully" });
      } catch (error) {
          console.error("Error deleting like:", error);
          res.status(500).json({ 
              error: error instanceof Error ? error.message : "Unknown error" 
          });
      }
  }
}
  
  export default LikeController;
  