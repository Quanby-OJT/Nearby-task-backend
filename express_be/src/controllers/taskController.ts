import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";

class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received insert data:", req.body);
      const {client_id, task_title, specialization, task_description, location, duration, num_of_days, urgency, contact_price, remarks, task_begin_date } = req.body;
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

      // Validate required fields
      if (!client_id || !task_title || !task_begin_date) {
        res.status(400).json({ error: "Missing required fields (client_id, job_title, task_begin_date)" });
        return;
      }

      // Call the model to insert data into Supabase
      const newTask = await taskModel.createNewTask(
        client_id,
        task_description,
        duration,
        task_title,
        urgency,
        location,
        num_of_days,
        specialization,
        contact_price,
        remarks,
        task_begin_date
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
      // const { data: tasks, error: taskError } = await supabase.from("tasks").select();
      // console.log("Data passed by frontend (query parameters):", req.query);

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

  // static async assignTask(req: Request, res: Response): Promise<void> {
  //   const {user_id, task_id } = req.body

  //   const {data, error} = await supabase.from("task_taken").insert({
  //     user_id,
  //     task_id,

  // }

  /**
   * The purpose of the codes is to display all tasks that belong to the user.
   * @param req
   * @param res
   */
  static async getTaskforClient(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.clientId;
      console.log(clientId);
      const { data, error } = await supabase
        .from("tasks")
        .select()
        .eq("client_id", clientId);

      if (error) {
        console.error(error.message);
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

  static async assignTask(req: Request, res: Response): Promise<void> {
    const { tasker_id, task_id, client_id } = req.body;

    const { data, error } = await supabase.from("task_taken").insert({
      tasker_id, //Tasker ID siya
      task_id,
      client_id,
      task_status: "In Negotiation", //Statuses are: In negotiation, Task In Progress, Completed, Cancelled, Rejected
    });

    if (error) {
      console.error(error.message);
      res
        .status(500)
        .json({ error: "An Error Occured while opening the conversation." });
    } else {
      res
        .status(201)
        .json({ message: "A New Conversation Has been Opened.", task: data });
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

  /**
   * The purpose of this code is to make specialization assignnment easy for taskers and clients.
   * @param req
   * @param res
   */
  static async getAllSpecializations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      console.log("Received request to get all specializations");
      const { data, error } = await supabase
        .from("tasker_specialization")
        .select("specialization");
      //console.log(data, error)

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
}

export default TaskController;
