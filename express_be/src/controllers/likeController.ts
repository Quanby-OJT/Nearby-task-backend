import { Request, Response } from "express";

import { supabase } from "../config/configuration";
import likeModel from "../models/likeModel";

class LikeController {
  static async createLike(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const { user_id, task_id, created_at} = req.body;

      // Check for missing fields
      if (!user_id || !task_id || !created_at) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Call the model to insert data into Supabase
      const newTask = await likeModel.create({
        user_id, 
        job_post_id: task_id, 
        created_at,
        like: true
      });

      res.status(201).json({ message: "You like this job!", success: true, data: newTask });
    } catch (error) {
      res
        .status(500)
        .json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  static async getLikedJob(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.id;

      const { data, error } = await supabase
        .from("likes")
        .select(`
          *,
          post_task:job_post_id (*).eq("status", "Available")
        `)  
        .eq("user_id", userId);

      console.log("Liked: " + data, "Errors :" + error);
      console.log("This is data of my liked tasks: " + data, "This is error: " + error);

      if (error) {
        console.error("Error fetching liked tasks:", error.message);
        res
          .status(500)
          .json({
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
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default LikeController;
