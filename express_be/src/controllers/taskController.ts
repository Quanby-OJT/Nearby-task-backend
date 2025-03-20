import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import { error } from "console";

class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
  
      const {
        client_id,
        task_title,
        specialization,
        task_description,
        location,
        duration,
        num_of_days,
        urgency,
        proposed_price,
        remarks,
        task_begin_date,
        user_id, 
        work_type,
      } = req.body;
      
     let urgent = false;
    if (urgency === "Urgent") urgent = true;
    else if (urgency === "Non-Urgent") urgent = false;

    if (!client_id || !task_title || !task_begin_date) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Convert duration and proposed_price to numbers
    const parsedDuration = Number(duration);
    const parsedPrice = Number(proposed_price);
    
    if (isNaN(parsedDuration) || isNaN(parsedPrice)) {
      res.status(400).json({ error: "Invalid duration or contact_price" });
      return;
    }

    const newTask = await taskModel.createNewTask(
      client_id,
      task_description,
      parsedDuration,
      task_title,
      urgent,  
      location,
      num_of_days,
      specialization,
      parsedPrice,
      remarks,
      task_begin_date,
      user_id,
      work_type,
    );

      res.status(201).json({ success: true, message: "Task posted successfully", task: newTask });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({
        success: false,
        message: "Task posted successfully",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }


  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
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

  static async getTaskforClient(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.clientId;
      console.log(clientId);
      const { data, error } = await supabase
        .from("post_task")
        .select()
        .eq("client_id", clientId);

      if (error) {
        console.error(error.message);
        res.status(500).json({ error: "An Error occured while retrieving your tasks. Please try again." });
      } else {
        res.status(200).json({ tasks: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async assignTask(req: Request, res: Response): Promise<void> {
    const { tasker_id, task_id, client_id } = req.body;

    const { data, error } = await supabase.from("task_taken").insert({
      tasker_id,
      task_id,
      client_id,
      task_status: "In Negotiation",
    });

    if (error) {
      console.error(error.message);
      res.status(500).json({ error: "An Error Occurred while opening the conversation." });
    } else {
      res.status(201).json({ message: "A New Conversation Has been Opened.", task: data });
    }
  }

  static async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);

      if (isNaN(taskId)) {
        res.status(400).json({ success: false, message: "Invalid task ID" });
        return;
      }

      const result = await taskModel.deleteTask(taskId);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred while deleting the task"
      });
    }
  }


  static async getAllSpecializations(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received request to get all specializations");
      const { data, error } = await supabase
        .from("tasker_specialization")
        .select("specialization");

      if (error) {
        console.error(error.message);
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

  static async getCreatedTaskByClient(req: Request, res: Response): Promise<void> {
    try {
      const clientId = parseInt(req.params.client_id);
      
      if (isNaN(clientId)) {
        res.status(400).json({ success: false, error: "Invalid client ID" });
        return;
      }
      
      const tasks = await taskModel.getTasksByClientId(clientId);
      
      res.status(200).json({ 
        success: true, 
        tasks: tasks 
      });
    } catch (error) {
      console.error("Error fetching tasks by client ID:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred while retrieving tasks"
      });
    }
  }

  static async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);
      const taskData = { ...req.body }; // Create a copy of the request body
      
      if (isNaN(taskId)) {
        res.status(400).json({ success: false, error: "Invalid task ID" });
        return;
      }
      
      console.log("Updating task with data:", taskData);
      
      // Handle numeric conversions if needed
      if (taskData.duration) {
        taskData.duration = Number(taskData.duration);
      }
      
      if (taskData.proposed_price) {
        taskData.proposed_price = Number(taskData.proposed_price);
      }
      
      // Handle urgency field
      if (taskData.urgency) {
        taskData.urgent = taskData.urgency === "Urgent";
        delete taskData.urgency; // Remove the urgency field since we're using urgent
      }
      
      const result = await taskModel.updateTask(taskId, taskData);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred while updating the task"
      });
    }
  }
}


export default TaskController;