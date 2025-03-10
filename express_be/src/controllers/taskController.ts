import { Request, Response } from "express";
import taskModel from "../models/taskModel";

class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const {
        client_id,
        job_title,
        specialization,
        description,
        location,
        duration,
        num_of_days,
        urgency,
        contact_price,
        remarks,
        task_begin_date,
      } = req.body;

      // Validate required fields
      if (!client_id || !job_title || !task_begin_date) {
        res.status(400).json({ error: "Missing required fields (client_id, job_title, task_begin_date)" });
        return;
      }

      // Call the model to insert data into Supabase
      const newTask = await taskModel.createNewTask(
        description,
        duration,
        job_title,
        urgency,
        location,
        num_of_days,
        specialization,
        contact_price,
        remarks,
        task_begin_date,
        client_id // Pass client_id to the model
      );

      res
        .status(201)
        .json({ message: "Task created successfully", task: newTask });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      console.log("Data passed by frontend (query parameters):", req.query);

      const tasks = await taskModel.getAllTasks();
      console.log("Retrieved tasks:", tasks);
      res.status(200).json({ tasks });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  
  static async getTaskById(req: Request, res: Response): Promise<void> {
    try {
        const jobPostId = parseInt(req.params.id); 
        console.log(jobPostId);
        if (isNaN(jobPostId)) {
            res.status(400).json({ message: "Invalid Job Post ID" });
            return;
        }

        const task = await taskModel.getTaskById(jobPostId);

        if (!task) {
            res.status(404).json({ message: "Task not found" });
            return;
        }

        res.status(200).json(task);
    } catch (error) {
        console.error("Server error:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
  }

  static async disableTask(req: Request, res: Response): Promise<void> {
    try {
      const jobPostId = parseInt(req.params.id);

      if (isNaN(jobPostId)) {
        res.status(400).json({ message: "Invalid task ID" });
        return;
      }

      const result = await taskModel.disableTask(jobPostId);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default TaskController;