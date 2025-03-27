import { Request, Response } from "express";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import { error } from "console";
import TaskerModel from "../models/taskerModel";
import { UserAccount } from "../models/userAccountModel";
import fetch from "node-fetch";
require("dotenv").config();

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
      console.log("Received request to get all specializations");
      const { data, error } = await supabase
        .from("tasker_specialization")
        .select("specialization").order("spec_id", { ascending: true });

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
      const { task_taken_id, amount } = req.body;

      const{data: userEmail, error: emailError} = await supabase
      .from("task_taken")
      .select(`
        clients!client_id (
          user!user_id(
            email
          )
        ),
        tasker!tasker_id (
          user!user_id(
            email
          )
        )
        `)
      .eq("task_taken_id", task_taken_id)
      .single();

      if(emailError){
        console.error("Error while updating Task Status", emailError.message, emailError.stack);
        res.status(500).json({ error: "An Error Occurred while processing your payment." });
        return
      }

      const taskerEmail = userEmail.tasker
      const clientEmail = userEmail.clients

      //Escrow API
      const escrowResponse = await fetch(`${process.env.ESCROW_API_URL}/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${process.env.ESCROW_API_KEY}`
        },
        body: JSON.stringify({
          "parties": [
            {
              "role": "buyer",
              "email": clientEmail
            },
            {
              "role": "seller",
              "email": taskerEmail
            }
          ],
          "amount": amount,
          "description": "Initial Deposit for Task Assignment.",
          "currency": "PHP"
        })
      }

      )
      const { data: escrowLog, error: escrowError } = await supabase
        .from("escrow_payment_logs")
        .insert({
          task_taken_id: task_taken_id,
          contract_price: amount,
          status: "Pending",
          escrow_transaction_id: escrowResponse,
          payment: amount 
        })
        .eq("task_id", task_taken_id);

      if (escrowError) {
        console.error("Error while updating Task Status", escrowError.message, escrowError.stack);
        res.status(500).json({ error: "An Error Occurred while processing your payment." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", escrow: escrowLog });
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }

  static async updateTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { task_taken_id, status } = req.body;
      const { data, error } = await supabase
        .from("escrow_payment_logs")
        .update({ status })
        .eq("task_taken_id", task_taken_id);

      if (error) {
        console.error("Error while updating Task Status", error.message, error.stack);
        res.status(500).json({ error: "An Error Occurred while updating the task status." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", task: data });
      }
    }
    catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }

  static async releasePayment(req: Request, res: Response): Promise<void> {
    try {
      const { task_taken_id, amount } = req.body;

      const{data: userEmail, error: emailError} = await supabase
      .from("task_taken")
      .select(`
        clients!client_id (
          user!user_id(
            email
          )
        ),
        tasker!tasker_id (
          user!user_id(
            email
          )
        )
        `)
      .eq("task_taken_id", task_taken_id)
      .single();

      if(emailError){
        console.error("Error while updating Task Status", emailError.message, emailError.stack);
        res.status(500).json({ error: "An Error Occurred while processing your payment." });
        return
      }

      const taskerEmail = userEmail.tasker
      const clientEmail = userEmail.clients

      //Escrow API
      const escrowResponse = await fetch(`${process.env.ESCROW_API_URL}/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `${process.env.ESCROW_API_KEY}`
        },
        body: JSON.stringify({
          "parties": [
            {
              "role": "buyer",
              "email": clientEmail
            },
            {
              "role": "seller",
              "email": taskerEmail
            }
          ],
          "amount": amount,
          "description": "Initial Deposit for Task Assignment.",
          "currency": "PHP"
        })
      }

      )
      const { data: escrowLog, error: escrowError } = await supabase
        .from("escrow_payment_logs")
        .insert({
          task_taken_id: task_taken_id,
          contract_price: amount,
          status: "Pending",
          escrow_transaction_id: escrowResponse,
          payment: amount 
        })
        .eq("task_id", task_taken_id);

      if (escrowError) {
        console.error("Error while updating Task Status", escrowError.message, escrowError.stack);
        res.status(500).json({ error: "An Error Occurred while processing your payment." });
      } else {
        res.status(200).json({ message: "Task status updated successfully", escrow: escrowLog });
      }
    }
    catch (error) {
      console.error(error instanceof Error ? error.message : "Error Unknown.")
      res.status(500).json({error: "Internal Server error",});
    }
  }

  static async getDocumentLink(req: Request, res: Response): Promise<any> {
    try {

      const documentId = parseInt(req.params.id);
      const { data, error } = await supabase
        .from("tasker_documents")
        .select("tesda_document_link")
        .eq("id", documentId)
        .single();

        console.log("This is the document link: ", documentId, data);
      res.status(200).json({ data: data?.tesda_document_link, error });
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
  
      console.log("Request body:", req.body);

      const { data: specializations, error: specialization_error } = await supabase
        .from("tasker_specialization")
        .select("spec_id")
        .eq("specialization", specialization)
        .single();
  
      if (specialization_error) throw new Error("Specialization Error: " + specialization_error.message);
  
      // Validate file uploads
      if (!req.files) {
        throw new Error("Missing required files (image and/or document)");
      }
      const { image, document } = req.files as {
        image: Express.Multer.File[],
        document: Express.Multer.File[]
      };

      console.log(image, document);
  
      // Upload profile picture
      const profileImagePath = `profile_pictures/${user_id}_${Date.now()}_${image[0].originalname}`;
      const { error: profilePicError } = await supabase.storage
        .from("documents")
        .upload(profileImagePath, image[0].buffer, {
          contentType: image[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });
  
      if (profilePicError) throw new Error("Error uploading profile picture: " + profilePicError.message);
  
      // Upload TESDA document
      const documentPath = `tesda_documents/${user_id}_${Date.now()}_${document[0].originalname}`;
      const { error: tesdaDocError } = await supabase.storage
        .from("documents")
        .upload(documentPath, document[0].buffer, {
          contentType: document[0].mimetype,
          cacheControl: "3600",
          upsert: true,
        });
  
      if (tesdaDocError) throw new Error("Error uploading TESDA document: " + tesdaDocError.message);
  
      // Get public URLs
      const profilePicUrl = supabase.storage
        .from("documents")
        .getPublicUrl(profileImagePath).data.publicUrl;
  
      const tesdaDocUrl = supabase.storage
        .from("documents")
        .getPublicUrl(documentPath).data.publicUrl;
  
      // Store TESDA document reference
      const { data: tesda_documents, error: tesda_error } = await supabase
        .from("tasker_documents")
        .insert({ tesda_document_link: tesdaDocUrl })
        .select("id")
        .single();
  
      if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);

      await UserAccount.uploadImageLink(user_id, profilePicUrl);
  
      // Create tasker profile
      await TaskerModel.createTasker({
        gender,
        contact_number,
        address,
        birthdate,
        profile_picture: profilePicUrl,
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

      console.log("Request body:", req.body);
      console.log("User ID:", userId);


      // Get specialization ID
      // const { data: specializationData, error: specializationError } = await supabase
      //   .from("tasker_specialization")
      //   .select("spec_id")
      //   .eq("specialization", specialization)
      //   .single();

      // if (specializationError) {
      //   throw new Error("Specialization Error: " + specializationError.message);
      // }

      // Update user account information
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

      // Get tasker record
      const { data: taskerData, error: taskerFetchError } = await supabase
        .from("tasker")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (taskerFetchError && taskerFetchError.code !== "PGRST116") {
        throw new Error("Error fetching tasker data: " + taskerFetchError.message);
      }

      // Update tasker information
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
}


export default TaskController;