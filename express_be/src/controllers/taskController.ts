import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";

class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const {user_id, job_title, specialization, description, location, duration, num_of_days, urgency, contact_price, remarks, task_begin_date } = req.body;
      let urgent = false;

      // Check for missing fields. This will be relocated to tasker/client validation.
      // if (!job_title || !specialization || !description || !location ||
      //     !duration || !num_of_days || !urgency || !contact_price ||
      //     !remarks || !task_begin_date) {
      //   res.status(400).json({ message: "Missing required fields" });
      //   return;
      // }

      if(urgency == "Urgent") urgent = true
      else if(urgency == "Non-Urgent") urgent = false

      // Call the model to insert data into Supabase
      const newTask = await taskModel.createNewTask(user_id,
        description, duration, job_title, urgency, location, 
        num_of_days, specialization, contact_price, remarks, task_begin_date
      );

      res
        .status(201)
        .json({ message: "Task created successfully", task: newTask });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown")
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase.from("job_post").select();

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

  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
      const taskId = req.params.id;
      const { data, error } = await supabase
        .from("job_post")
        .select()
        .eq("job_post_id", taskId) // Changed from 'id' to 'job_post_id'
        .single();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ message: "Task not found" });
        return;
      }

      res.status(200).json(data);
    } catch (error) {
      console.error("Server error:", error); // Add detailed logging
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async disableTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = req.params.id;
      const { error } = await supabase
        .from("job_post")
        .update({ status: "disabled" })
        .eq("job_post_id", taskId);

      if (error) {
        throw error;
      }

      res.status(200).json({ message: "Task disabled successfully" });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * The purpose of this code is to make specialization assignnment easy for taskers and clients.
   * @param req 
   * @param res 
   */
  static async getAllSpecializations(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received request to get all specializations");
      const { data, error } = await supabase.from("tasker_specialization").select('specialization');
      //console.log(data, error)

      if (error) {
        console.error(error.message)
        res.status(500).json({ error: error.message });
      } else {  
        res.status(200).json({ specializations: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default TaskController;
