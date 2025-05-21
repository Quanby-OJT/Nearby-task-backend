import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import console from "console";
import TaskerModel from "../models/taskerModel";
import { UserAccount } from "../models/userAccountModel";
import fetch from "node-fetch";
require("dotenv").config();
import QTaskPayment from "../models/paymentModel";
import { WebSocketServer } from "ws";
import ClientModel from "./clientController";

const ws = new WebSocketServer({ port: 8080 });


class TaskController {
  static async createTask(req: Request, res: Response): Promise<void> {
    try {
      const photo = req.file;
      console.log("Received photo:", photo);
      console.log("Received task data:", req.body);
      console.log("Received insert data:", req.body);    

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
      } = req.body;

      const amount = await QTaskPayment.checkBalance(client_id);

      if(proposed_price > amount.amount){
        const remainingAmount = proposed_price - amount.amount
        res.status(403).json({error: `You have insufficient funds to create this task. Please Deposit An Additional P${remainingAmount} in order to create this task.`})
        return
      }

      // Validate and parse price
      const parsedPrice = Number(proposed_price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({ success: false, error: 'Invalid proposed price' });
        return;
      }

      // Parse urgent as boolean
      const isUrgent = urgent === 'true' || urgent === true;

      // Parse is_verified_document as boolean
      const isVerified = is_verified_document === 'true' || is_verified_document === true;

      // Parse related_specializations (expecting JSON string like '[5,7,3,2]')
      let parsedRelatedSpecializations: number[] | null = null;
      if (related_specializations) {
        try {
          parsedRelatedSpecializations = JSON.parse(related_specializations);
          if (!Array.isArray(parsedRelatedSpecializations)) {
            res.status(400).json({ success: false, error: 'Invalid related specializations format' });
            return;
          }
        } catch (e) {
          res.status(400).json({ success: false, error: 'Failed to parse related specializations' });
          return;
        }
      }

      // Handle photo upload to Supabase Storage
      let image_url: string | null = null;
      if (photo) {
        const fileName = `tasks/image_${user_id}_${Date.now()}_${photo.originalname}`;
        console.log("Uploading Image File:", fileName);

        const { error } = await supabase.storage
          .from("crud_bucket")
          .upload(fileName, photo.buffer, {
            contentType: photo.mimetype,
            cacheControl: '3600',
            upsert: true,
          });

        if (error) {
          res.status(500).json({ success: false, error: `Error uploading image: ${error.message}` });
          return;
        }

        image_url = supabase.storage.from("crud_bucket").getPublicUrl(fileName).data.publicUrl;
      }

      // Insert task into Supabase
      const { data, error } = await supabase
        .from("post_task")
        .insert([
          {
            client_id: Number(client_id),
            task_title,
            specialization_id: Number(specialization_id),
            task_description,
            address:address_id,
            urgent: isUrgent,
            proposed_price: parsedPrice,
            remarks,
            status,
            work_type,
            related_specializations: parsedRelatedSpecializations,
            scope,
            is_verified: isVerified,
            image_url,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        res.status(500).json({ success: false, error: `Failed to create task: ${error.message}` });
        return;
      }

      await QTaskPayment.deductAmountfromUser(amount.user_role, amount.amount, user_id)

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
  
      if (isNaN(taskId)) {
        res.status(400).json({ success: false, message: "Invalid task ID" });
        return;
      }
  
      const result = await taskModel.disableTask(taskId);
  
      res.status(200).json(result);
    } catch (error) {
      console.error("Error in disableTask:", error);
      res.status(500).json({
        success: false,
        message: "An error occurred while closing the task",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  static async getTaskWithSpecialization(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await taskModel.getTaskWithSpecialization(req.query.specialization as string);
      res.status(200).json({ tasks });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }


  static async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const tasks = await taskModel.getAllTasks();
      //console.log("Retrieved tasks:", tasks);
      res.status(200).json({ tasks });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async fetchAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const { data:task, error } = await supabase
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
        )
      `)
        .not("clients", "is", null)
        .eq("clients.user.user_role", "Client");
  

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
        error: error instanceof Error ? error.message : "Unknown error occurred",
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

    static async getTaskforClient(req: Request, res: Response): Promise<void> {
    
        const clientId = req.params.clientId;
    
      try {
        const { data:task, error } = await supabase
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
          error: "Tasker ID is required"
        });
        return;
      }
      const { data, error } = await supabase
        .from("task_taken")
        .select(`
          task_id,
          task_status,
          created_at,
          client_id,
          tasker_id,
          task:post_task(
            task_id,
            task_title,
            task_description,
            duration,
            proposed_price,
            urgent,
            location,
            specialization,
            status
          ),
          client:clients(
            client_id,
            user_id,
            client_address
          )
        `)
        .eq("tasker_id", taskerId);

      if (error) {
        console.error("Error fetching tasks for tasker:", error);
        res.status(500).json({
          success: false,
          error: error.message || "Failed to fetch tasks for this tasker"
        });
        return;
      }

      res.status(200).json({
        success: true,
        tasks: data
      });
    } catch (error) {
      console.error("Error in getTaskforTasker:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred"
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
        // No record found
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
    const { tasker_id, task_id, client_id, role } = req.body;

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

    const {data: task} = await supabase.from("task_taken").select("*").eq("task_id", task_id).eq("tasker_id", tasker_id).eq("client_id", client_id).single();

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
      requested_from
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

  static async getAssignedTaskbyId(req: Request, res: Response): Promise<void> {
    try {
      const taskTakenId = parseInt(req.params.task_taken_id);

      if (isNaN(taskTakenId)) {
        res.status(400).json({ success: false, error: "Invalid task taken ID" });
        return;
      }

      const task_information = await taskModel.getAssignedTask(taskTakenId);

      res.status(200).json({ success: true, task_information });
    } catch (error) {
      console.error("Error fetching task by task taken ID:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "An error occurred while retrieving task"
      });
    }
  }

//Specialization Part Ito

static async getAllSpecializations(req: Request, res: Response): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("tasker_specialization")
      .select("spec_id, specialization")
      .order("spec_id", { ascending: true });

    if (error) {
      console.error(error.message);
      res.status(500).json({ error: error.message });
      return;
    }
// This is for formatting date like formatting yun like date and time na format
    const formattedSpecialization = (data ?? []).map((specialization: any) => ({
      ...specialization,
      created_at: specialization.created_at
        ? new Date(specialization.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
        : null,
    }));

    res.status(200).json({ specializations: formattedSpecialization });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

  static async createSpecialization(req: Request, res: Response): Promise<void> {
    try {
      const { specialization } = req.body;
  
      if (!specialization) {
        res.status(400).json({ error: "Specialization name is required" });
        return;
      }
  
      const { data, error } = await supabase
        .from("tasker_specialization")
        .insert({ specialization })
        .select();
  
      if (error) {
        console.error("Error adding specialization:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }
  
      res.status(201).json({ message: "Specialization added successfully", specialization: data[0] });
    } catch (error) {
      console.error("Error in createSpecialization:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
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

      console.log("Tasks data:", tasks);

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
      const taskData = { ...req.body };
      if (isNaN(taskId)) {
        res.status(400).json({ success: false, error: "Invalid task ID" });
        return;
      }

      console.log("Updating task with data:", taskData);

      if (taskData.duration) {
        taskData.duration = Number(taskData.duration);
      }

      if (taskData.proposed_price) {
        taskData.proposed_price = Number(taskData.proposed_price);
      }

      if (taskData.urgency) {
        taskData.urgent = taskData.urgency === "Urgent";
        delete taskData.urgency;
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
  static async updateTaskStatusforTasker(req: Request, res: Response): Promise<void> {
    try {
      const taskTakenId = parseInt(req.params.requestId);
      const { task_status, reason_for_rejection_or_cancellation } = req.body;

      console.log("Data::", task_status, reason_for_rejection_or_cancellation);

      if (isNaN(taskTakenId)) {
        res.status(400).json({ success: false, error: "Invalid task taken ID" });
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
          console.error("Error while updating Task Status", error.message, error.stack);
          res.status(500).json({ error: "An Error Occurred while updating the task status." });
        } else {
          res.status(200).json({ message: "Task status updated successfully"});
        }
        return
      }else{
        const { data, error } = await supabase
          .from("task_taken")
          .update({ task_status })
          .eq("task_taken_id", taskTakenId);

        if (error) {
          console.error("Error while updating Task Status", error.message, error.stack);
          res.status(500).json({ error: "An Error Occurred while updating the task status." });
        } else {
          res.status(200).json({ message: "Task status updated successfully", task: data });
        }
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({ error: "Internal Server error", });
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
      res.status(500).json({ error: "Internal Server error", });
    }
  }

  static async releasePayment(req: Request, res: Response): Promise<void> {
    try {
      const { task_taken_id, amount, status } = req.body;

      const { data: userEmail, error: emailError } = await supabase
        .from("task_taken")
        .select(`
          clients (
            user:user_id (email)
          ),
          tasker:tasker_id (
            user:user_id (email)
          )
        `)
        .eq("task_taken_id", task_taken_id)
        .single();
        if (emailError) {
          console.error("Error while retrieving Data: ", emailError.message, emailError.stack);
          res.status(500).json({ error: "An Error Occurred while processing your payment." });
          return
        }

        // Access the nested email properties correctly
        const taskerEmail = userEmail?.tasker
        const clientEmail = userEmail?.clients

        if (!clientEmail || !taskerEmail) {
          throw new Error("Could not retrieve client or tasker email");
        }
        const escrowResponse = await fetch(`${process.env.ESCROW_API_URL}/transaction`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer${process.env.ESCROW_API_KEY}`
          },
          body: JSON.stringify({
            "parties": [
              {
                "role": "buyer",
                "email": taskerEmail
              },
              {
                "role": "seller",
                "email": clientEmail
              }
            ],
            "amount": amount,
            "description": "Initial Deposit for Task Assignment.",
            "currency": "PHP",
            "return_url": `${process.env.ESCROW_API_URL}/transaction/${task_taken_id}/deposit`
          })
        })

        const escrowData = await escrowResponse.json() as { id: string, url: string };

        if (!escrowResponse.ok) {
          console.error("Escrow API Error: ", escrowData);
          res.status(500).json({ error: "An error occured while processing your transaction. Please Try Again Later." });
          return
        }

        const escrowTransactionId = escrowData.id
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
          console.error("Error while processing your payment: ", escrowError.message, escrowError.stack);
          res.status(500).json({ error: "An Error Occurred while processing your payment." });
        } else {
          res.status(200).json({ message: "Processing your payment...", payment_url: escrowData.url });
        }
    }
    catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({ error: "Internal Server error", });
    }
  }

  static async getTokenBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId); // Assume authenticated client ID
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

      switch (userRole.user_role) {
        case "Tasker":
          const { data: taskerTokens, error: taskerTokensError} = await supabase.from('tasker').select('amount').eq('user_id', userId).single();
          if(taskerTokensError) throw new Error('Error fetching tasker tokens: ' + taskerTokensError.message);
          //console.log("Tasker Tokens: ", taskerTokens);
          res.status(200).json({ success: true, tokens: taskerTokens.amount });
          break;
        case "Client":
          const { data: clientTokens, error: clientTokensError} = await supabase.from('clients').select('amount').eq('user_id', userId).single();
          if(clientTokensError) throw new Error('Error fetching tasker tokens: ' + clientTokensError.message);
          //console.log("Client Tokens: ", clientTokens);
          res.status(200).json({ success: true, tokens: clientTokens.amount });
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Error fetching token balance:", error);
      res.status(500).json({ success: false, error: "Failed to fetch tokens" });
    }
  }

  static notifyClient(clientId: number, amount: number) {
    ws.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ clientId, amount }));
      }
    });
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
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({ data: null, error: error instanceof Error ? error.message : "Error Unknown." });
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

      const { data: specializations, error: specialization_error } = await supabase
        .from("tasker_specialization")
        .select("spec_id")
        .eq("specialization", specialization)
        .single();

      if (specialization_error) throw new Error("Specialization Error: " + specialization_error.message);

      if (!req.files) {
        throw new Error("Missing required files (image and/or document)");
      }
      const { image, document } = req.files as {
        image: Express.Multer.File[],
        document: Express.Multer.File[]
      };

      console.log(image, document);

      const profileImagePath = `profile_pictures/${user_id}_${Date.now()}_${image[0].originalname}`;
      const { error: profilePicError } = await supabase.storage
        .from("documents")
        .upload(profileImagePath, image[0].buffer, {
          contentType: image[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (profilePicError) throw new Error("Error uploading profile picture: " + profilePicError.message);

      const documentPath = `tesda_documents/${user_id}_${Date.now()}_${document[0].originalname}`;
      const { error: tesdaDocError } = await supabase.storage
        .from("documents")
        .upload(documentPath, document[0].buffer, {
          contentType: document[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });

      if (tesdaDocError) throw new Error("Error uploading TESDA document: " + tesdaDocError.message);

      const profilePicUrl = supabase.storage
        .from("documents")
        .getPublicUrl(profileImagePath).data.publicUrl;

      const tesdaDocUrl = supabase.storage
        .from("documents")
        .getPublicUrl(documentPath).data.publicUrl;

      const { data: tesda_documents, error: tesda_error } = await supabase
        .from("tasker_documents")
        .insert({ tesda_document_link: tesdaDocUrl })
        .select("id")
        .single();

      if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);

      await UserAccount.uploadImageLink(user_id, profilePicUrl);
  // add here profile picture update   profile_picture: profilePicUrl,
      // Create tasker profile
      await TaskerModel.createTasker({
        address,   
        user_id,
        bio,
        specialization_id: specializations.spec_id,
        skills,
        availability: availability === 'true',
        wage_per_hour: parseFloat(wage_per_hour),
        tesda_documents_id: tesda_documents.id,
        social_media_links: social_media_links
      });

      res.status(201).json({ taskerStatus: true });
    } catch (error) {
      console.error("Error in createTasker:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error in createTasker:", error instanceof Error ? error.stack : "Internal Server Error");
      res.status(500).json({
        error: "An Error Occurred while Creating Tasker. Please Try Again.",
      });
    }
  }

  // tasker without email and profile image and file
  static async updateTaskerProfileNoImages(req: Request, res: Response): Promise<void> {
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
        specialization,
        bio,
        skills,
        wage_per_hour,
        pay_period
      } = req.body;

      console.log("Request body from tasker:", req.body);

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
          birthdate

        })
        .eq("user_id", userId)
        .select("*")
        .single();

      if (userError) {
        throw new Error("Error updating user account: " + userError.message);
      }

      const { data: taskerData, error: taskerFetchError } = await supabase
        .from("tasker")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (taskerFetchError && taskerFetchError.code !== "PGRST116") {
        throw new Error("Error fetching tasker data: " + taskerFetchError.message);
      }

      // Update tasker information

      console.log("Tasker Specialization:", specialization);
      const { data: updatedTaskerData, error: taskerUpdateError } = await supabase
        .from("tasker")
        .update({
          bio,
          skills,
          specialization_id: specialization,
          wage_per_hour: parseFloat(wage_per_hour),
          pay_period
        })
        .eq("user_id", userId)
        .select()
        .single();

      if (taskerUpdateError) {
        throw new Error("Error updating tasker data: " + taskerUpdateError.message);
      }

      res.status(200).json({
        message: "Tasker profile updated successfully",
        user: userData,
        tasker: updatedTaskerData
      });
    } catch (error) {
      console.error("Error in updateTaskerProfileNoImages:", error instanceof Error ? error.message : "Internal Server Error");
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace available");
      res.status(500).json({
        errors: "An error occurred while updating the tasker profile: " + (error instanceof Error ? error.message : "Unknown error")
      });
    }
  }

  static async checkTaskAssignment(req: Request, res: Response): Promise<any> {
    try {
        const { taskId, taskerId } = req.params;
        
        // Add your database query here to check if the task is assigned
        const { data: assignment, error } = await supabase
            .from('task_taken')
            .select()
            .eq('task_id', parseInt(taskId))
            .eq('tasker_id', parseInt(taskerId))
            .maybeSingle();

        if (error) {
            throw new Error('Error checking task assignment');
        }

        return res.status(200).json({
            isAssigned: assignment !== null,
            message: assignment ? "Task is assigned to this tasker" : "Task is not assigned to this tasker"
        });
    } catch (error) {
        console.error("Error checking task assignment:", error);
        return res.status(500).json({
            error: "Failed to check task assignment",
            isAssigned: false
        });
    }
  }

  static async getAllCompletedTasks(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("post_task")
        .select(`
          task_title,
          proposed_price,
        `)
        .eq("task_status", "Completed")
        .eq("is_deleted", false);

      if (error) {
        console.error(error.message);
        res.status(500).json({ error: "An Error Occurred while Retrieving Your Completed Tasks. Please Try Again" });
        return;
      }
      res.status(200).json({ data: data });
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  static async getTasks(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
  
    // Validate userId
    if (!userId || isNaN(Number(userId))) {
      res.status(400).json({ error: "Invalid or missing userId" });
      return;
    }
  
    try {
      const { data, error } = await supabase
        .from("task_taken")
        .select(`
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
        `)
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
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      });
    }
  }

  static async getTaskInformation(req: Request, res: Response): Promise<void> {
    const { taskId } = req.params;
    try {
      const { data, error } = await supabase
      .from("task_taken")
      .select(`
        task_id,
        task_status,
        created_at,
        client_id,
        tasker_id,
        task:post_task(
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
        ),
        client:clients(
          client_id,
          user:user_id(*),
          client_address
        )
          location,
          specialization,
          status
        ),
        client:clients(
          client_id,
          user:user_id(*),
          client_address
        )
      `)
      .eq("task_id", taskId)
      .maybeSingle();

      if (error) {
        console.error("Error fetching task information:", error.message);
        res.status(500).json({ error: "Failed to retrieve task information. Please try again." });
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