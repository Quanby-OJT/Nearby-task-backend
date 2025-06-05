import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import console from "console";
import { UserAccount } from "../models/userAccountModel";
import fetch from "node-fetch";
require("dotenv").config();
import QTaskPayment from "../models/paymentModel";
import { WebSocketServer } from "ws";
import ClientModel from "./clientController";

class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      const photos = req.files as Express.Multer.File[];
      console.log("Received photos:", photos);
      console.log("Received task data:", req.body);

      const {
        client_id,
        task_title,
        specialization_id,
        related_specializations,
        task_description,
        address_id,
        urgent,
        proposed_price,
        remarks,
        work_type,
        scope,
        is_verified_document,
        user_id,
        status,
        task_begin_date,
      } = req.body;

      const amount = await QTaskPayment.checkBalance(client_id);
      if (!amount) {
        res.status(404).json({ error: "User not found or insufficient funds." });
        return;
      }else if (!amount?.amount || amount.amount <= 0) {
        res.status(403).json({ error: `You have no money in your wallet. Please Deposit an additional P${proposed_price} in order to create this task.`  });
        return;
      }

      if(proposed_price > amount.amount){
        const remainingAmount = proposed_price - amount.amount
        res.status(403).json({error: `You have insufficient funds to create this task. Please Deposit An Additional P${remainingAmount} in order to create this task.`})
        return
      }

      const parsedPrice = Number(proposed_price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res
          .status(400)
          .json({ success: false, error: "Invalid proposed price" });
        return;
      }

      const isUrgent = urgent === "true" || urgent === true;

      const isVerified =
        is_verified_document === "true" || is_verified_document === true;

      let parsedRelatedSpecializations: number[] | null = null;
      if (related_specializations) {
        try {
          parsedRelatedSpecializations = JSON.parse(related_specializations);
          if (!Array.isArray(parsedRelatedSpecializations)) {
            res.status(400).json({
              success: false,
              error: "Invalid related specializations format",
            });
            return;
          }
        } catch (e) {
          res.status(400).json({
            success: false,
            error: "Failed to parse related specializations",
          });
          return;
        }
      }

      let imageIds: number[] = [];
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        const fileName = `task_images/image_${user_id}_${Date.now()}_${photo.originalname}`;
        console.log("Uploading Image File:", fileName);

        const { error: uploadError } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, photo.buffer, {
            contentType: photo.mimetype,
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) {
          res.status(500).json({
            success: false,
            error: `Error uploading image: ${uploadError.message}`,
          });
          return;
        }

        const image_url = supabase.storage
          .from("crud_bucket")
          .getPublicUrl(fileName).data.publicUrl;

        const { data: imageData, error: imageInsertError } = await supabase
          .from("post_task_images")
          .insert([
            {
              image_link: image_url,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              user_id: client_id,
            },
          ])
          .select("id")
          .single();

        if (imageInsertError) {
          res.status(500).json({
            success: false,
            error: `Error saving image metadata: ${imageInsertError.message}`,
          });
          return;
        }

          imageIds.push(imageData.id);
        }
      }

      const { data, error } = await supabase
        .from("post_task")
        .insert([
          {
            client_id: Number(client_id),
            task_title,
            specialization_id: Number(specialization_id),
            task_description,
            address: address_id,
            urgent: isUrgent,
            proposed_price: parsedPrice,
            remarks,
            status,
            work_type,
            related_specializations: parsedRelatedSpecializations,
            scope,
            is_verified: isVerified,
            task_begin_date,
            image_ids: imageIds.length > 0 ? imageIds : null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        res.status(500).json({
          success: false,
          error: `Failed to create task: ${error.message}`,
        });
        return;
      }

      const remainingAmount = amount.amount - proposed_price;
      await QTaskPayment.deductAmountfromUser(amount.user_role, remainingAmount, user_id)

      res.status(201).json({
        success: true,
        message: "Task posted successfully",
        task: data,
      });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async disableTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);
      const { loggedInUserId, reason } = req.body;

      if (isNaN(taskId)) {
        res.status(400).json({ success: false, message: "Invalid task ID" });
        return;
      }

      if (!loggedInUserId || isNaN(loggedInUserId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid logged-in user ID" });
        return;
      }

      if (!reason) {
        res.status(400).json({ success: false, message: "Reason for closing task is required" });
        return;
      }

      const { data: userExists, error: userCheckError } = await supabase
        .from("user")
        .select("user_id")
        .eq("user_id", parseInt(loggedInUserId))
        .single();

      if (userCheckError || !userExists) {
        console.error("User does not exist:", userCheckError || "No user found");
        res.status(400).json({
          success: false,
          message: "Logged-in user does not exist in the system",
        });
        return;
      }

      const { data: actionData, error: actionError } = await supabase
        .from("action_taken_by")
        .insert({
          user_id: parseInt(loggedInUserId),
          action_reason: reason,
          created_at: new Date().toISOString(),
          task_id: taskId
        })
        .select()
        .single();

      if (actionError) {
        console.error("Supabase insert error for action_taken_by:", actionError);
        res.status(500).json({
          success: false,
          message: `Failed to log action: ${actionError.message}`,
        });
        return;
      }

      console.log("Action taken by data inserted:", actionData);

      const { data, error } = await supabase
        .from("post_task")
        .update({ status: "Closed", action_by: parseInt(loggedInUserId) })
        .eq("task_id", taskId)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        res.status(500).json({
          success: false,
          message: `Failed to close task: ${error.message}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Task closed successfully",
        task: data,
      });
    } catch (error) {
      console.error("Error in disableTask:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while closing the task",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async activateTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);
      const { loggedInUserId, reason } = req.body;

      if (isNaN(taskId)) {
        res.status(400).json({ success: false, message: "Invalid task ID" });
        return;
      }

      if (!loggedInUserId || isNaN(loggedInUserId)) {
        res
          .status(400)
          .json({ success: false, message: "Invalid logged-in user ID" });
        return;
      }

      if (!reason) {
        res.status(400).json({ success: false, message: "Reason for activating task is required" });
        return;
      }

      const { data: userExists, error: userCheckError } = await supabase
        .from("user")
        .select("user_id")
        .eq("user_id", parseInt(loggedInUserId))
        .single();

      if (userCheckError || !userExists) {
        console.error("User does not exist:", userCheckError || "No user found");
        res.status(400).json({
          success: false,
          message: "Logged-in user does not exist in the system",
        });
        return;
      }

      const { data: actionData, error: actionError } = await supabase
        .from("action_taken_by")
        .insert({
          user_id: parseInt(loggedInUserId),
          action_reason: reason,
          created_at: new Date().toISOString(),
          task_id: taskId
        })
        .select()
        .single();

      if (actionError) {
        console.error("Supabase insert error for action_taken_by:", actionError);
        res.status(500).json({
          success: false,
          message: `Failed to log action: ${actionError.message}`,
        });
        return;
      }

      console.log("Action taken by data inserted:", actionData);

      const { data, error } = await supabase
        .from("post_task")
        .update({ status: "Available", action_by: parseInt(loggedInUserId) })
        .eq("task_id", taskId)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        res.status(500).json({
          success: false,
          message: `Failed to activate task: ${error.message}`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Task activated successfully",
        task: data,
      });
    } catch (error) {
      console.error("Error in activateTask:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while activating the task",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getTaskWithSpecialization(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const tasks = await taskModel.getTaskWithSpecialization(
        req.query.specialization as string
      );
      res.status(200).json({ tasks });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const { data: tasks, error } = await supabase
        .from("post_task")
        .select(
          `
          *,
          clients:client_id (
            client_id,
            user:user_id (
              user_id,
              first_name,
              middle_name,
              last_name
            )
          ),
          action_by_user:user!action_by (
            user_id,
            first_name,
            middle_name,
            last_name,
            user_role
          ),
          action_taken_by:action_taken_by!task_id (
            action_reason,
            user_id,
            created_at
          )
        `
        )
        .order("task_id", { ascending: false });

      if (error) {
        console.error("Supabase error:", error.message);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }

      const processedTasks = tasks.map(task => {
        if (task.action_taken_by && task.action_taken_by.length > 0) {
          const sortedActions = [...task.action_taken_by].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });
          
          const latestAction = sortedActions[0];
          task.action_reason = latestAction.action_reason;
          task.action_by = latestAction.user_id;
        }
        return task;
      });
  
      res.status(200).json({ tasks: processedTasks });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async fetchAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const { data:   task, error } = await supabase
          .from("post_task")
          .select(
          `
        *,
        tasker_specialization:specialization_id (specialization),
        address (*),
        clients!client_id (
          user (
          user_id,
          first_name,
          middle_name,
          last_name,
          email,
          contact,
          gender,
          birthdate,
          user_role,
          acc_status,
          verified,
          image_link
          )
        )
      `
        )
        .not("clients", "is", null)
        .eq("clients.user.user_role", "Client")
        .eq("status", "Available");

      console.log("This is fetchTask");
      console.log("Taskers data:", task, "Error:", error);

      if (error) {
        console.error("Error fetching taskers:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      if (!task || task.length === 0) {
        res.status(200).json({ error: "No active taskers found." });
        return;
      }

      res.status(200).json({ taskers: task });
    } catch (error) {
      console.error("Error fetching taskers:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
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

      res.status(200).json({ tasks: task });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getTaskforClientAvailable(
    req: Request,
    res: Response
  ): Promise<void> {
    const clientId = req.params.clientId;

    try {
      const [taskResult, taskTakenResult] = await Promise.all([
        supabase
          .from("post_task")
          .select(
            `
            *,
            tasker_specialization:specialization_id (specialization),
            address (*),
            clients!client_id (
              user (
                user_id,
                first_name,
                middle_name,
                last_name,
                email,
                contact,
                gender,
                birthdate,
                user_role,
                acc_status,
                verified,
                image_link
              )
            )
          `
          )
          .neq("status", "Already Taken")
          .eq("client_id", clientId)
          .eq("clients.user.user_role", "Client"),

        supabase
          .from("task_taken")
          .select(
            `
            task_taken_id,
            task_id,
            task_status,
            created_at,
            client_id,
            tasker_id,
             tasker:tasker!tasker_id (
                user_id,
                  user (
                    user_id,
                    first_name,
                    middle_name,
                    last_name,
                    email,
                    contact,
                    gender,
                    birthdate,
                    user_role,
                    acc_status,
                    verified,
                    image_link
                  )
                ),
            
            task:post_task (
              *,
              tasker_specialization:specialization_id (specialization),
              address (*),
              client:clients!client_id (
                client_id,
                user (
                  user_id,
                  first_name,
                  middle_name,
                  last_name,
                  email,
                  contact,
                  gender,
                  birthdate,
                  user_role,
                  acc_status,
                  verified,
                  image_link
                )
              )
            )
          `
          )
          .eq("client_id", clientId),
      ]);

      if (taskResult.error) {
        console.error("Error fetching tasks:", taskResult.error.message);
        res.status(500).json({
          success: false,
          error: "Failed to fetch tasks",
          details: taskResult.error.message,
        });
        return;
      }

      if (taskTakenResult.error) {
        console.error(
          "Error fetching taken tasks:",
          taskTakenResult.error.message
        );
        res.status(500).json({
          success: false,
          error: "Failed to fetch taken tasks",
          details: taskTakenResult.error.message,
        });
        return;
      }

      if (!taskResult.data || taskResult.data.length === 0) {
        res.status(200).json({
          success: true,
          tasks: [],
          taskTaken: taskTakenResult.data || [],
          message: "No active tasks found",
        });
        return;
      }

      console.log("Task data:", taskResult.data);
      console.log("Task taken data:", taskTakenResult.data);

      res.status(200).json({
        success: true,
        tasks: taskResult.data,
        taskTaken: taskTakenResult.data || [],
      });
    } catch (error) {
      console.error("Unexpected error fetching tasks:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  static async getTaskforClient(req: Request, res: Response): Promise<void> {
    const clientId = req.params.clientId;
    
    try {
      const { data: task, error } = await supabase
        .from("post_task")
        .select(`
          *,
          tasker_specialization:specialization_id (specialization),
          address (*),
          clients!client_id (
            user (
              user_id,
              first_name,
              middle_name,
              last_name,
              email,
              contact,
              gender,
              birthdate,
              user_role,
              acc_status,
              verified,
              image_link
            )
          ),
          action_by:user!action_by (
            user_id,
            first_name,
            middle_name,
            last_name
          )
        `)
        .eq("client_id", clientId)
        .eq("clients.user.user_role", "Client");
    
      console.log("Tasks data:", task, "Error:", error);
    
      if (error) {
        console.error("Error fetching tasks:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }
    
      if (!task || task.length === 0) {
        res.status(200).json({ error: "No active tasks found." });
        return;
      }
    
      res.status(200).json({ tasks: task });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  static async getTaskforTasker(req: Request, res: Response): Promise<void> {
    try {
      const taskerId = req.params.taskerId || req.query.tasker_id;

      if (!taskerId) {
        res.status(400).json({
          success: false,
          error: "Tasker ID is required",
        });
        return;
      }
      const { data, error } = await supabase
        .from("task_taken")
        .select(
          `
          task_id,
          task_status,
          created_at,
          client_id,
          tasker_id,
          task:post_task(
            *
          ),  
          client:clients(
            *
          )
        `
        )
        .eq("tasker_id", taskerId);

      if (error) {
        console.error("Error fetching tasks for tasker:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch tasks for this tasker",
        });
        return;
      }

      res.status(200).json({
        success: true,
        tasks: data,
      });
    } catch (error) {
      console.error("Error in getTaskforTasker:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async fetchIsApplied(req: Request, res: Response): Promise<void> {
    const { task_id, tasker_id, client_id } = req.query;

    const taskId = parseInt(task_id as string, 10);
    const taskerId = parseInt(tasker_id as string, 10);
    const clientId = parseInt(client_id as string, 10);

    if (!taskId || !taskerId || !clientId) {
      res.status(400).json({ error: "Missing required query parameters" });
      return;
    }
    try {
      const { data: task, error } = await supabase
        .from("task_taken")
        .select("*")
        .eq("task_id", taskId)
        .eq("tasker_id", taskerId)
        .eq("client_id", clientId)
        .single();

      if (error) {
        res.status(200).json({ message: "False", task: null });
        return;
      }

      if (task) {
        res.status(200).json({ message: "True", task });
        return;
      }

      res.status(200).json({ message: "False", task: null });
    } catch (err) {
      console.error("Error fetching task:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async assignTask(req: Request, res: Response): Promise<void> {
    const {
      tasker_id,
      task_id,
      client_id,
      role,
      days_available,
    
    } = req.body;

    console.log("Role this is: " + role);

    let visit_client = false;
    let visit_tasker = false;
    let requested_from = "";

    if (role == "Client") {
      visit_client = true;
      visit_tasker = false;
      requested_from = "Client";
    } else {
      visit_client = false;
      visit_tasker = true;
      requested_from = "Tasker";
    }

    const { data: task } = await supabase
      .from("task_taken")
      .select("*")
      .eq("task_id", task_id)
      .eq("tasker_id", tasker_id)
      .eq("client_id", client_id)
      .single();

    if (task) {
      res.status(400).json({ error: "Task already assigned" });
      return;
    }

    const { data, error } = await supabase.from("task_taken").insert({
      tasker_id,
      task_id,
      client_id,
      visit_client,
      visit_tasker,
      task_status: "Pending",
      requested_from,
      time_request: days_available,
    });

    if (error) {
      console.error(error.message);
      res
        .status(500)
        .json({ error: "An Error Occurred while opening the conversation." });
    } else {
      res
        .status(201)
        .json({ message: "A New Conversation Has been Opened.", task: data });
    }
  }

  static async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const taskId = parseInt(req.params.id);

      if (isNaN(taskId)) {
        res.status(400).json({ success: false, message: "Invalid task ID" });
        return;
      }

      const clientTask = await taskModel.getTaskById(taskId);
      if (!clientTask) {
        res.status(404).json({ success: false, message: "Task not found" });
        return;
      }
      if(clientTask.status === "Available") {
        await QTaskPayment.refundAvailableTaskAmountToClient(taskId);
      }
      const result = await taskModel.deleteTask(taskId);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while deleting the task",
      });
    }
  }

  static async getAssignedTaskbyId(req: Request, res: Response): Promise<void> {
    try {
      const taskTakenId = parseInt(req.params.task_taken_id);

      if (isNaN(taskTakenId)) {
        res
          .status(400)
          .json({ success: false, error: "Invalid task taken ID" });
        return;
      }

      const task_information = await taskModel.getAssignedTask(taskTakenId);

      res.status(200).json({ success: true, task_information });
    } catch (error) {
      console.error("Error fetching task by task taken ID:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while retrieving task",
      });
    }
  }

  
  static async getAllImages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { taskId } = req.params;

      console.log("Task ID:", taskId);

      const { data: task, error: taskError } = await supabase
        .from('post_task')
        .select('image_ids')
        .eq('task_id', taskId)
        .single();

      if (taskError || !task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      interface TaskImage {
        id: number;
        image_link: string;
        created_at: string;
        updated_at: string;
      }

      let images: TaskImage[] = [];
      if (task.image_ids && task.image_ids.length > 0) {
        
        const { data: imageData, error: imageError } = await supabase
          .from('post_task_images')
          .select('id, image_link, created_at, updated_at')
          .in('id', task.image_ids);

        if (imageError) {
          res.status(500).json({ success: false, error: imageError.message });
          return;
        }

        images = imageData || [];
      }

      res.status(200).json({ success: true, images });
    } catch (error) {
      console.error('Error fetching task images:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }


  static async getAllSpecializations(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("tasker_specialization")
        .select(
          `
          *,
          action_by_user:user!action_by (
            user_id,
            first_name,
            middle_name,
            last_name
          )
        `
        )
        .order("spec_id", { ascending: true });

      if (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
        return;
      }
      const formattedSpecialization = (data ?? []).map(
        (specialization: any) => ({
          ...specialization,
          created_at: specialization.created_at
            ? new Date(specialization.created_at).toLocaleString("en-US", {
                timeZone: "Asia/Manila",
              })
            : null,
        })
      );

      res.status(200).json({ specializations: formattedSpecialization });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async createSpecialization(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { specialization, user_id, reason } = req.body;

      if (!specialization) {
        res.status(400).json({ error: "Specialization name is required" });
        return;
      }

      if (!user_id || isNaN(user_id)) {
        res.status(400).json({ error: "Valid user ID is required" });
        return;
      }

      if (!reason) {
        res.status(400).json({ error: "Reason for adding specialization is required" });
        return;
      }
  
      const { data: userExists, error: userCheckError } = await supabase
        .from("user")
        .select("user_id")
        .eq("user_id", parseInt(user_id))
        .single();

      if (userCheckError || !userExists) {
        console.error("User does not exist:", userCheckError || "No user found");
        res.status(400).json({
          success: false,
          message: "Logged-in user does not exist in the system",
        });
        return;
      }

      const { data: actionData, error: actionError } = await supabase
        .from("action_taken_by")
        .insert({
          user_id: parseInt(user_id),
          action_reason: reason,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (actionError) {
        console.error("Supabase insert error for action_taken_by:", actionError);
        res.status(500).json({
          success: false,
          message: `Failed to log action: ${actionError.message}`,
        });
        return;
      }

      console.log("Action taken by data inserted:", actionData);
  
      const { data, error } = await supabase
        .from("tasker_specialization")
        .insert({ specialization, action_by: parseInt(user_id) })
        .select();

      if (error) {
        console.error("Error adding specialization:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json({
        message: "Specialization added successfully",
        specialization: data[0],
      });
    } catch (error) {
      console.error("Error in createSpecialization:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getCreatedTaskByClient(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const clientId = parseInt(req.params.client_id);

      if (isNaN(clientId)) {
        res.status(400).json({ success: false, error: "Invalid client ID" });
        return;
      }

      const tasks = await taskModel.getTasksByClientId(clientId);

      console.log("Tasks data:", tasks);

      res.status(200).json({
        success: true,
        tasks: tasks,
      });
    } catch (error) {
      console.error("Error fetching tasks by client ID:", error);
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while retrieving tasks",
      });
    }
  }

  static async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const photos = req.files as Express.Multer.File[];
      const {
        client_id,
        task_title,
        task_description,
        proposed_price,
        urgent,
        remarks,
        work_type,
        address,
        specialization_id,
        related_specializations,
        scope,
        task_begin_date,
        status,
        is_verified,
        image_ids,
        images_to_delete,
      } = req.body;

      console.log("Task ID:", taskId);
      console.log("Task Data:", req.body);
  
      if (!task_title || !task_description || !proposed_price) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: task_title, task_description, or proposed_price',
        });
        return;
      }
  
      const parsedPrice = Number(proposed_price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({ success: false, error: 'Invalid proposed price' });
        return;
      }
  
      const parsedClientId = Number(client_id);
      if (isNaN(parsedClientId)) {
        res.status(400).json({ success: false, error: 'Invalid client_id' });
        return;
      }
  
      const parsedSpecializationId = specialization_id ? Number(specialization_id) : null;
      if (specialization_id && isNaN(Number(specialization_id))) {
        res.status(400).json({ success: false, error: 'Invalid specialization_id' });
        return;
      }
  
      const isUrgent = urgent === 'true' || urgent === true;
      const isVerified = is_verified === 'true' || is_verified === true;
  
      let parsedRelatedSpecializations: number[] | null = null;
      if (related_specializations) {
        try {
          parsedRelatedSpecializations = JSON.parse(related_specializations);
          if (!Array.isArray(parsedRelatedSpecializations)) {
            res.status(400).json({
              success: false,
              error: 'Related specializations must be an array',
            });
            return;
          }
        } catch (e) {
          res.status(400).json({
            success: false,
            error: 'Failed to parse related specializations',
          });
          return;
        }
      }
  
      let currentImageIds: number[] = [];
      if (image_ids) {
        try {
          currentImageIds = JSON.parse(image_ids);
          if (!Array.isArray(currentImageIds)) {
            res.status(400).json({
              success: false,
              error: 'Image IDs must be an array',
            });
            return;
          }
        } catch (e) {
          res.status(400).json({
            success: false,
            error: 'Failed to parse image_ids',
          });
          return;
        }
      }
  
      let imagesToDelete: number[] = [];
      if (images_to_delete) {
        try {
          imagesToDelete = JSON.parse(images_to_delete);
          if (!Array.isArray(imagesToDelete)) {
            res.status(400).json({
              success: false,
              error: 'Images to delete must be an array',
            });
            return;
          }
        } catch (e) {
          res.status(400).json({
            success: false,
            error: 'Failed to parse images_to_delete',
          });
          return;
        }
      }
  
      if (imagesToDelete.length > 0) {
        const { data: imagesToRemove, error: imageError } = await supabase
          .from('post_task_images')
          .select('id, image_link')
          .in('id', imagesToDelete);
  
        if (imageError) {
          res.status(500).json({ success: false, error: imageError.message });
          return;
        }
  
        if (imagesToRemove.length > 0) {
          const filePaths = imagesToRemove.map((img) =>
            img.image_link.split('/').slice(-2).join('/')
          );
  
          const { error: storageError } = await supabase.storage
            .from('crud_bucket')
            .remove(filePaths);
  
          if (storageError) {
            res.status(500).json({ success: false, error: storageError.message });
            return;
          }
  
          const { error: deleteError } = await supabase
            .from('post_task_images')
            .delete()
            .in('id', imagesToDelete);
  
          if (deleteError) {
            res.status(500).json({ success: false, error: deleteError.message });
            return;
          }
        }
      }
  
      let newImageIds: number[] = [];
      if (photos && photos.length > 0) {
        for (const photo of photos) {
          const fileName = `task_images/image_${client_id}_${Date.now()}_${photo.originalname}`;
          const { error: uploadError } = await supabase.storage
            .from('crud_bucket')
            .upload(fileName, photo.buffer, {
              contentType: photo.mimetype,
              cacheControl: '3600',
              upsert: true,
            });
  
          if (uploadError) {
            res.status(500).json({
              success: false,
              error: `Failed to upload image: ${uploadError.message}`,
            });
            return;
          }
  
          const imageUrl = supabase.storage
            .from('crud_bucket')
            .getPublicUrl(fileName).data.publicUrl;
  
          const { data: imageData, error: imageInsertError } = await supabase
            .from('post_task_images')
            .insert({
              image_link: imageUrl,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id')
            .single();
  
          if (imageInsertError) {
            res.status(500).json({
              success: false,
              error: imageInsertError.message,
            });
            return;
          }
  
          newImageIds.push(imageData.id);
        }
      }
  
      const updatedImageIds = [
        ...currentImageIds.filter((id) => !imagesToDelete.includes(id)),
        ...newImageIds,
      ];

      console.log("Updated Image IDs:", updatedImageIds);

      try {
        await QTaskPayment.updateAmount(parsedPrice, parsedClientId, taskId);
      } catch (err) {
        res.status(400).json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to update client balance',
        });
        return;
      }

      const { data, error } = await supabase
        .from('post_task')
        .update({
          client_id: parsedClientId,
          task_title,
          task_description,
          proposed_price: parsedPrice,
          urgent: isUrgent,
          remarks: remarks || null,
          work_type,
          address: address || null,
          specialization_id: parsedSpecializationId,
          related_specializations: parsedRelatedSpecializations,
          scope,
          task_begin_date: task_begin_date || null,
          status: status || 'Available',
          is_verified,
          image_ids: updatedImageIds.length > 0 ? updatedImageIds : null,
        })
        .eq('task_id', taskId)
        .select()
        .single();
  
      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }
  
      res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        task: data,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }




  static async updateTaskStatusforTasker(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const taskTakenId = parseInt(req.params.requestId);
      const { task_status, reason_for_rejection_or_cancellation } = req.body;

      console.log("Data::", task_status, reason_for_rejection_or_cancellation);

      if (isNaN(taskTakenId)) {
        res
          .status(400)
          .json({ success: false, error: "Invalid task taken ID" });
        return;
      }

      const transactionId = await QTaskPayment.fetchTransactionId(taskTakenId);

      if(task_status == "Rejected" || task_status == "Cancelled"){
        if(task_status == "Cancelled"){
          await QTaskPayment.cancelTransaction(transactionId, reason_for_rejection_or_cancellation);
          res.status(200).json({ message: "You had cancelled your task."});

        }

        const { error } = await supabase
          .from("task_taken")
          .update({ task_status, reason_for_rejection_or_cancellation })
          .eq("task_taken_id", taskTakenId);

        if (error) {
          console.error(
            "Error while updating Task Status",
            error.message,
            error.stack
          );
          res.status(500).json({
            error: "An Error Occurred while updating the task status.",
          });
        } else {
          res.status(200).json({ message: "Task status updated successfully" });
        }
        return;
      } else {
        const { data, error } = await supabase
          .from("task_taken")
          .update({ task_status })
          .eq("task_taken_id", taskTakenId);

        if (error) {
          console.error(
            "Error while updating Task Status",
            error.message,
            error.stack
          );
          res.status(500).json({
            error: "An Error Occurred while updating the task status.",
          });
        } else {
          res
            .status(200)
            .json({ message: "Task status updated successfully", task: data });
        }
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.");
      res.status(500).json({ error: "Internal Server error" });
    }
  }

  static async updateTaskStatusforClient(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { task_id, status } = req.body;
      const { data, error } = await supabase
        .from("post_task")
        .update({ status })
        .eq("task_id", task_id);

      if (error) {
        console.error(
          "Error while updating Task Status",
          error.message,
          error.stack
        );
        res
          .status(500)
          .json({ error: "An Error Occurred while updating the task status." });
      } else {
        res
          .status(200)
          .json({ message: "Task status updated successfully", task: data });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.");
      res.status(500).json({ error: "Internal Server error" });
    }
  }

  static async releasePayment(req: Request, res: Response): Promise<void> {
    try {
      const { task_taken_id, amount, status } = req.body;

      const { data: userEmail, error: emailError } = await supabase
        .from("task_taken")
        .select(
          `
          clients (
            user:user_id (email)
          ),
          tasker:tasker_id (
            user:user_id (email)
          )
        `
        )
        .eq("task_taken_id", task_taken_id)
        .single();
      if (emailError) {
        console.error(
          "Error while retrieving Data: ",
          emailError.message,
          emailError.stack
        );
        res
          .status(500)
          .json({ error: "An Error Occurred while processing your payment." });
        return;
      }

      const taskerEmail = userEmail?.tasker;
      const clientEmail = userEmail?.clients;

      if (!clientEmail || !taskerEmail) {
        throw new Error("Could not retrieve client or tasker email");
      }
      const escrowResponse = await fetch(
        `${process.env.ESCROW_API_URL}/transaction`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer${process.env.ESCROW_API_KEY}`,
          },
          body: JSON.stringify({
            parties: [
              {
                role: "buyer",
                email: taskerEmail,
              },
              {
                role: "seller",
                email: clientEmail,
              },
            ],
            amount: amount,
            description: "Initial Deposit for Task Assignment.",
            currency: "PHP",
            return_url: `${process.env.ESCROW_API_URL}/transaction/${task_taken_id}/deposit`,
          }),
        }
      );

      const escrowData = (await escrowResponse.json()) as {
        id: string;
        url: string;
      };

      if (!escrowResponse.ok) {
        console.error("Escrow API Error: ", escrowData);
        res.status(500).json({
          error:
            "An error occured while processing your transaction. Please Try Again Later.",
        });
        return;
      }

      const escrowTransactionId = escrowData.id;
      const { data: escrowLog, error: escrowError } = await supabase
        .from("escrow_payment_logs")
        .insert({
          task_taken_id: task_taken_id,
          contract_price: amount,
          status: status,
          escrow_transaction_id: escrowTransactionId,
        })
        .eq("task_id", task_taken_id);

      if (escrowError) {
        console.error(
          "Error while processing your payment: ",
          escrowError.message,
          escrowError.stack
        );
        res
          .status(500)
          .json({ error: "An Error Occurred while processing your payment." });
      } else {
        res.status(200).json({
          message: "Processing your payment...",
          payment_url: escrowData.url,
        });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.");
      res.status(500).json({ error: "Internal Server error" });
    }
  }

  static async getTokenBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        res.status(400).json({ success: false, error: "Invalid client ID" });
        return;
      }

      const { data: userRole, error: userRoleError } = await supabase
        .from("user")
        .select("user_role")
        .eq("user_id", userId)
        .single();

      if (userRoleError || !userRole) {
        throw new Error("User Does not exist from database.");
      }

      let tableRow = ""

      switch (userRole.user_role) {
        case "Tasker":
          tableRow = "tasker";
          break;
        case "Client":
          tableRow = "clients";
          break;
        default:
          res.status(400).json({
            success: false,
            error: "Invalid user role",
          });
          return;
      }

      const { data: tokens, error: tokensError } = await supabase
        .from(tableRow)
        .select("amount")
        .eq("user_id", userId)
        .single();

      if (tokensError || !tokens) {
        throw new Error(
          "Error fetching tokens: " + (tokensError ? tokensError.message : "No tokens found")
        );
      }

      res.status(200).json({ success: true, tokens: tokens.amount });

    } catch (error) {
      console.error("Error fetching token balance:", error);
      res.status(500).json({ success: false, error: "Failed to fetch tokens" });
    }
  }

  static async getDocumentLink(req: Request, res: Response): Promise<any> {
    try {
      const taskerId = parseInt(req.params.id);
      console.log("This is the tasker id: ", taskerId);
      const { data, error } = await supabase
        .from("tasker_documents")
        .select("*")
        .eq("tasker_id", taskerId)
        .single();

      console.log("This is the document link: ", taskerId, data);
      res.status(200).json({ data: data, error });
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.");
      res.status(500).json({
        data: null,
        error: error instanceof Error ? error.message : "Error Unknown.",
      });
    }
  }

  static async updateTaskerProfile(req: Request, res: Response): Promise<void> {
    try {
      const {
        gender,
        contact_number,
        address,
        birth_date: birthdate,
        user_id,
        bio,
        specialization,
        skills,
        availability,
        wage_per_hour,
        social_media_links,
      } = req.body;

      console.log("Request body from another tasker:", req.body);

      if (!req.files) {
        throw new Error("Missing required files (image and/or document)");
      }
      const { image, document } = req.files as {
        image: Express.Multer.File[];
        document: Express.Multer.File[];
      };

      console.log(image, document);

      const profileImagePath = `profile_pictures/${user_id}_${Date.now()}_${
        image[0].originalname
      }`;
      const { error: profilePicError } = await supabase.storage
        .from("documents")
        .upload(profileImagePath, image[0].buffer, {
          contentType: image[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (profilePicError)
        throw new Error(
          "Error uploading profile picture: " + profilePicError.message
        );

      const documentPath = `tesda_documents/${user_id}_${Date.now()}_${
        document[0].originalname
      }`;
      const { error: tesdaDocError } = await supabase.storage
        .from("documents")
        .upload(documentPath, document[0].buffer, {
          contentType: document[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (tesdaDocError)
        throw new Error(
          "Error uploading TESDA document: " + tesdaDocError.message
        );

      const profilePicUrl = supabase.storage
        .from("documents")
        .getPublicUrl(profileImagePath).data.publicUrl;

      const tesdaDocUrl = supabase.storage
        .from("documents")
        .getPublicUrl(documentPath).data.publicUrl;

      await UserAccount.uploadImageLink(user_id, profilePicUrl);

      if (bio || social_media_links) {
        const verificationData: any = {};
        if (bio) verificationData.bio = bio;
        if (social_media_links) verificationData.social_media_links = social_media_links;
        verificationData.updated_at = new Date().toISOString();

        const { error: verifyError } = await supabase
          .from("user_verify")
          .upsert({
            user_id: parseInt(user_id),
            ...verificationData
          });

        if (verifyError) {
          console.warn("Could not update user_verify table:", verifyError);
        }
      }

      if (tesdaDocUrl) {
        const documentData = {
          tasker_id: user_id,
          user_document_link: tesdaDocUrl,
          updated_at: new Date().toISOString()
        };
        
        const { error: docError } = await supabase
          .from('user_documents')
          .upsert(documentData);
          
        if (docError) {
          console.warn("Could not update user_documents table:", docError);
        }
      }

      res.status(201).json({ taskerStatus: true });
    } catch (error) {
      console.error(
        "Error in updateTaskerProfile:",
        error instanceof Error ? error.message : "Internal Server Error"
      );
      console.error(
        "Error in updateTaskerProfile:",
        error instanceof Error ? error.stack : "Internal Server Error"
      );
      res.status(500).json({
        error: "An Error Occurred while Creating Tasker. Please Try Again.",
      });
    }
  }

  static async updateTaskerProfileNoImages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.params.id;
      const {
        first_name,
        middle_name,
        last_name,
        email,
        user_role,
        contact,
        gender,
        birthdate,
        bio,
        social_media_links,
      } = req.body;

      console.log("Request body from user:", req.body);
      console.log("User ID:", userId);

      const { data: userData, error: userError } = await supabase
        .from("user")
        .update({
          first_name,
          middle_name,
          last_name,
          email,
          user_role,
          contact,
          gender,
          birthdate,
        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (userError) {
        throw new Error("Error updating user account: " + userError.message);
      }

      if (bio || social_media_links) {
        const verificationData: any = {};
        if (bio) verificationData.bio = bio;
        if (social_media_links) verificationData.social_media_links = social_media_links;
        verificationData.updated_at = new Date().toISOString();

        const { error: verifyError } = await supabase
          .from("user_verify")
          .upsert({
            user_id: parseInt(userId),
            ...verificationData
          });

        if (verifyError) {
          console.warn("Could not update user_verify table:", verifyError);
        }
      }

      res.status(200).json({
        message: "User profile updated successfully",
        user: userData,
      });
    } catch (error) {
      console.error(
        "Error in updateTaskerProfileNoImages:",
        error instanceof Error ? error.message : "Internal Server Error"
      );
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack trace available"
      );
      res.status(500).json({
        errors:
          "An error occurred while updating the user profile: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  }

  static async checkTaskAssignment(req: Request, res: Response): Promise<any> {
    try {
      const { taskId, taskerId } = req.params;

      const { data: assignment, error } = await supabase
        .from("task_taken")
        .select()
        .eq("task_id", parseInt(taskId))
        .eq("tasker_id", parseInt(taskerId))
        .maybeSingle();

      if (error) {
        throw new Error("Error checking task assignment");
      }

      return res.status(200).json({
        isAssigned: assignment !== null,
        message: assignment
          ? "Task is assigned to this tasker"
          : "Task is not assigned to this tasker",
      });
    } catch (error) {
      console.error("Error checking task assignment:", error);
      return res.status(500).json({
        error: "Failed to check task assignment",
        isAssigned: false,
      });
    }
  }

  static async getAllCompletedTasks(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("post_task")
        .select(
          `
          task_title,
          proposed_price,
        `
        )
        .eq("task_status", "Completed")
        .eq("is_deleted", false);

      if (error) {
        console.error(error.message);
        res.status(500).json({
          error:
            "An Error Occurred while Retrieving Your Completed Tasks. Please Try Again",
        });
        return;
      }
      res.status(200).json({ data: data });
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  static async getTasksClient(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!userId || isNaN(Number(userId))) {
      res.status(400).json({ error: "Invalid or missing userId" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("task_taken")
        .select(
          `
        task_taken_id,
        task_id,
        task_status,
        created_at,
        client_id,
        tasker_id,
        post_task:task_id (
          *,
          tasker_specialization:specialization_id (specialization),
          address:address (*)
        ),
        tasker:tasker_id (
          tasker_id,
          user:user_id (
            user_id,
            first_name,
            middle_name,
            last_name,
            email,
            contact,
            gender,
            birthdate,
            user_role,
            acc_status,
            verified,
            image_link
          )
        )
      `
        )
        .eq("client_id", userId);

      if (error) {
        console.error("Supabase error:", error.message);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve tasks",
          details: error.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      });
    }
  }
  static async getTasks(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!userId || isNaN(Number(userId))) {
      res.status(400).json({ error: "Invalid or missing userId" });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("task_taken")
        .select(
          `
          task_taken_id,
          task_id,
          task_status,
          created_at,
          client_id,
          tasker_id,
          task:post_task (
            *,
            tasker_specialization:specialization_id (specialization),
            address (*),
            client:clients!client_id (
              client_id,
              user (
                user_id,
                first_name,
                middle_name,
                last_name,
                email,
                contact,
                gender,
                birthdate,
                user_role,
                acc_status,
                verified,
                image_link
              )
            )
          )
        `
        )
        .eq("tasker_id", userId);

      if (error) {
        console.error("Supabase error:", error.message);
        res.status(500).json({
          success: false,
          error: "Failed to retrieve tasks",
          details: error.message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      });
    }
  }

  static async getTaskInformation(req: Request, res: Response): Promise<void> {
    const { taskId } = req.params;
    try {
      const { data, error } = await supabase
        .from("task_taken")
        .select(
          `
          task_taken_id,
          task_id,
          task_status,
          created_at,
          client_id,
          tasker_id,
          task:post_task (
            *,
            tasker_specialization:specialization_id (specialization),
            address (*)),
          client:tasker!tasker_id (
            tasker_id,
            user (
              user_id,
              first_name,
              middle_name,
              last_name,
              email,
              contact,
              gender,
              birthdate,
              user_role,
              acc_status,
              verified,
              image_link
            )
          )
        )
      `)
      .eq("task_taken_id", taskId)
      .maybeSingle();

      console.log("Task Data: ", data, "Task Error: ", error)

      if (error) {
        console.error("Error fetching task information:", error.message);
        res.status(500).json({
          error: "Failed to retrieve task information. Please try again.",
        });
        return;
      }

      res.status(200).json({ data: data });
    } catch (error) {
      console.error("Error fetching task information:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default TaskController;