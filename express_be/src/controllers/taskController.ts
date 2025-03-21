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

    const parsedDuration = parseInt(duration as unknown as string);
    const parsedContactPrice = parseFloat(proposed_price as unknown as string);
    if (isNaN(parsedDuration) || isNaN(parsedContactPrice)) {
      res.status(400).json({ error: "Invalid duration or proposed_price" });
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
      parsedContactPrice,
      remarks,
      task_begin_date,
      user_id,
      work_type,
    );

      res.status(201).json({ message: "Task created successfully", task: newTask });
    } catch (error) {
      res.status(500).json({
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

      res.status(200).json({tasks: task});
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

  static async updateTaskStatusforTasker(req: Request, res: Response): Promise<void> {
    try {
      const { task_taken_id, status } = req.body;
      const { data, error } = await supabase
        .from("task_taken")
        .update({ task_status: status })
        .eq("task_id", task_taken_id);

      if (error) {
        console.error("Error while updating Task Status", error.message, error.stack);
        res.status(500).json({ error: "An Error Occurred while updating the task status." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", task: data });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }

  static async updateTaskStatusforClient(req: Request, res: Response): Promise<void> {
    try {
      const { task_id, status } = req.body;
      const { data, error } = await supabase
        .from("post_task")
        .update({ status })
        .eq("task_id", task_id);

      if (error) {
        console.error("Error while updating Task Status", error.message, error.stack);
        res.status(500).json({ error: "An Error Occurred while updating the task status." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", task: data });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }

      /**
     * The contarct price set by the client will be sent first to Escrow and will be released to the Tasker once the task is completed.
     * 
     * 
     * 
     * How will it work, according to documentation?
     * 
     * 1. If the client and tasker come to the final contract price agreement and the tasker "Confirmed", the client will deposit the amount to Escrow.
     * 2. As the tasker starts the task assigned, the client can monitor it.
     * 3. Once the task is completed, the client will release the amount to the tasker.
     * 4. If the tasker did not complete the task, the client can cancel the task and the amount will be returned to the client.
     * 
     * -Ces
     */
  static async depositTaskPayment(req: Request, res: Response): Promise<void> {
    try {
      const { task_id, amount } = req.body;

      
      const { data, error } = await supabase
        .from("escrow_payment_logs")
        .update({ payment: amount })
        .eq("task_id", task_id);

      if (error) {
        console.error("Error while updating Task Status", error.message, error.stack);
        res.status(500).json({ error: "An Error Occurred while updating the task status." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", task: data });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }
}


export default TaskController;