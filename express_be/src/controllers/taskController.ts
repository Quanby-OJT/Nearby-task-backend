import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import { error } from "console";
import TaskerModel from "../models/taskerModel";
import { UserAccount } from "../models/userAccountModel";
import { TaskAssignment } from "../models/taskAssignmentModel";
import fetch from "node-fetch";
import { User } from "@supabase/supabase-js";
require("dotenv").config();
import PayMongoPayment from "../models/paymentModel";
import ClientModel from "./clientController";
import { WebSocketServer } from "ws";

const ws = new WebSocketServer({ port: 8080 });


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
      //console.log("Retrieved tasks:", tasks);
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

      res.status(200).json({ tasks: task });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
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

  static async getTaskforClient(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.clientId;
      console.log("Client ID:", clientId);
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

      // Query task_taken table with join to get task details
      // Using task_id as the identifier since 'id' doesn't exist
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

    console.log("Role: ${role}");

    let visit_client = false;
    let visit_tasker = false;

    
    if (role == "Client") {
      visit_client = true;
      visit_tasker = false;
    } else {
      visit_client = false;
      visit_tasker = true;
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


  static async getAllSpecializations(req: Request, res: Response): Promise<void> {
    try {
      //console.log("Received request to get all specializations");
      const { data, error } = await supabase
        .from("tasker_specialization")
        .select("specialization").order("spec_id", { ascending: true });

      //console.log("Data retrieved:", data);

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

      const transactionId = await PayMongoPayment.fetchTransactionId(taskTakenId);

      if(task_status == "Rejected" || task_status == "Cancelled"){
        if(task_status == "Cancelled"){
          await PayMongoPayment.cancelTransaction(transactionId, reason_for_rejection_or_cancellation);
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

    /**
   * The contarct price set by the client will be sent first to Escrow and will be released to the Tasker once the task is completed.
   * 
   * 
   * 
   * How will it work, according to documentation?
   * 
   * 1. If the client and tasker come to the final contract price agreement and the tasker "Confirmed", the client will deposit the amount to Escrow.
   * 2. As the tasker starts the task assigned, the client can monitor it via chat.
   * 3. Once the task is completed, the client will release the amount to the tasker.
   * 4. If the tasker did not complete the task, the client can cancel the task and the amount will be returned to the client.
   * 
   * -Ces
   */
    static async depositEscrowAmount(req: Request, res: Response): Promise<void> {
      try {
          console.log("Transaction Data: ", req.body);
          const { client_id, amount, status } = req.body;

          const PaymentInformation = await PayMongoPayment.checkoutPayment({
              client_id,
              amount,
              deposit_date: new Date().toISOString(),
              payment_type: "Client Deposit"
          });

          await ClientModel.addCredits(client_id, amount)
  
          res.status(200).json({
              success: true,
              payment_url: PaymentInformation.paymentUrl,
              transaction_id: PaymentInformation.transactionId,
          });
      } catch (error) {
          console.error("Error in depositTaskPayment:", error instanceof Error ? error.message : error);
          res.status(500).json({ error: "Internal Server Error" });
      }
  }

  // static async updateTransactionStatus(req: Request, res: Response): Promise<void> {
  //   try {
  //     const { task_taken_id, status, cancellation_reason } = req.body;

  //     if(status == 'cancel'){
  //       await PayMongoPayment.cancelTransaction(task_taken_id, cancellation_reason);
  //       res.status(200).json({ message: "You had cancelled your transaction."});
  //     }else if(status == 'complete'){
  //       await PayMongoPayment.releasePayment('', task_taken_id);
  //       res.status(200).json({ message: "Escrow Payment Released to Tasker."});
  //     }else{
  //       res.status(400).json({ message: "Invalid status provided."});
  //     }
  //   }
  //   catch (error) {
  //     console.error(error instanceof Error ? error.message : "Error Unknown.")
  //     res.status(500).json({ error: "Internal Server error", });
  //   }
  // }

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

  static async handlePayMongoWebhook(req: Request, res: Response): Promise<void> {
    try{
      const event = req.body.data.attributes
      console.log("Received webhook event:", event);

      if(event.type === "payment.paid") {
        const payment = event.data.attributes;
        const transactionId = payment.checkout_session_id;
        const amount = payment.amount; // Convert to PHP
        const tokens = amount;

        const {data: paymentLog, error: loggingError} = await supabase.from("payment_logs")
          .select("client_id")
          .eq("transaction_id", transactionId)
          .single();
        if(loggingError) throw new Error(loggingError.message);

        const { data: clientData, error: fetchError } = await supabase
          .from("clients")
          .select("amount")
          .eq("client_id", paymentLog.client_id)
          .single();

        if (fetchError || !clientData) {
          throw new Error("Error fetching client data: " + (fetchError?.message || "Client not found"));
        }

        const updatedAmount = clientData.amount + tokens;


        const { error: tokenError } = await supabase
          .from("clients")
          .update({ amount: updatedAmount })
          .eq("client_id", paymentLog.client_id);

        if (tokenError) {
          throw new Error("Error updating client amount: " + tokenError.message);
        }
      }

      res.status(200).json({ message: "Webhook received successfully" })
    }catch(error){
      console.error("Webhook Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
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
          console.log("Tasker Tokens: ", taskerTokens);
          res.status(200).json({ success: true, tokens: taskerTokens.amount });
          break;
        case "Client":
          const { data: clientTokens, error: clientTokensError} = await supabase.from('clients').select('amount').eq('user_id', userId).single();
          if(clientTokensError) throw new Error('Error fetching tasker tokens: ' + clientTokensError.message);
          console.log("Client Tokens: ", clientTokens);
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
} 


export default TaskController;