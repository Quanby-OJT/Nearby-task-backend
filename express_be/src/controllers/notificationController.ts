import { Request, Response } from "express";
import { supabase } from "../config/configuration";
import { error } from "console";
import PayMongoPayment from "../models/paymentModel";
import taskModel from "../models/taskModel";

class NotificationController {

  static async getTaskerRequest(req: Request, res: Response): Promise<any> {
      try {
        const userID = req.params.userId;
        console.log("User ID:", userID);
    
        if (!userID) {
          res.status(400).json({ error: "User ID is required." });
          return;
        }
    
        // Fetch user data to determine role
        const { data: userData, error: userError } = await supabase
          .from("user")
          .select("user_id, user_role")
          .eq("user_id", userID)
          .maybeSingle();
    
        if (userError) {
          console.error("User fetch error:", userError.message);
          res.status(500).json({ error: "An error occurred while fetching user data." });
          return;
        }
    
        if (!userData) {
          res.status(404).json({ error: "User not found." });
          return;
        }

        const fetchRequest = async (
          userID: string,
          column: "client_id" | "tasker_id",
          visitColumn: "visit_client" | "visit_tasker",
          otherUserColumn: "client_id" | "tasker_id"
        ) => {
          const { data: tasks, error: tasksError } = await supabase
            .from("task_taken")
            .select("*")
            .eq(column, userID)
            .eq(visitColumn, false);
        
          if (tasksError) {
            console.error(`Task fetch error for ${column}:`, tasksError.message);
            throw new Error("An error occurred while fetching notifications.");
          }
        
          if (!tasks || tasks.length === 0) {
            return [];
          }
        
          // Format tasks
          const formattedData = await Promise.all(
            tasks.map(async (task) => {
              // Fetch task title from post_task
              const { data: titleData, error: titleError } = await supabase
                .from("post_task")
                .select("task_title")
                .eq("task_id", task.task_id)
                .maybeSingle();
        
              if (titleError) {
                console.error(
                  `Task title fetch error for task ${task.task_taken_id}:`,
                  titleError.message
                );
              }
        
              // Fetch user data for the other party (tasker or client)
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task[otherUserColumn])
                .maybeSingle();
        
              if (userError) {
                console.error(
                  `User fetch error for task ${task.task_taken_id}:`,
                  userError.message
                );
              }
        
              // Format the name of the other party
              const otherUserName =
                userData?.first_name && userData?.last_name
                  ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                  : column === "client_id"
                  ? "Unknown Tasker"
                  : "Unknown Client";
        
              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                name: otherUserName,
                role: column === "client_id" ? "client" : "tasker",
              };
            })
          );
        
          console.log(`Fetched and formatted data for ${column}:`, formattedData);
          return formattedData;
        };


        // Fetch notifications based on role
        let formattedData: any[] = [];
        if (userData.user_role === "Client") {
          formattedData = await fetchRequest(userID, "client_id", "visit_client", "tasker_id");
        } else if (userData.user_role === "Tasker") {
          formattedData = await fetchRequest(userID, "tasker_id", "visit_tasker", "client_id");
        } else {
          res.status(400).json({ error: "Invalid user role." });
          return;
        }
    
        // Return response
        res.status(200).json({
          message: formattedData.length
            ? "Successfully fetched notifications"
            : "No notifications found",
          data: formattedData,
        });
      } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
  }

  static async getPendingRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      console.log("User ID:", userID);
  
      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }
  
      // Function to fetch and format tasks
      const fetchTasks = async (column: 'client_id' | 'tasker_id') => {
        const { data: tasks, error } = await supabase
          .from("task_taken")
          .select("*")
          .eq(column, userID)
          .eq("task_status", "Pending");
  
        if (error) {
          throw new Error(`Error fetching ${column} tasks: ${error.message}`);
        }
  
        if (!tasks?.length) {
          return [];
        }
  
        return Promise.all(tasks.map(async (task) => {
          // Fetch task title
          const { data: titleData, error: titleError } = await supabase
            .from("post_task")
            .select("task_title")
            .eq("task_id", task.task_id)
            .maybeSingle();
  
          if (titleError) {
            console.error(`Title fetch error for task ${task.task_taken_id}: ${titleError.message}`);
          }
  
          // Fetch user data
         if(column === 'client_id') {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.tasker_id)
              .maybeSingle();
  
            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }
  
            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Rejected",
              date: task.created_at || new Date().toISOString().split("T")[0],
              remarks: task.remark || "No description provided",
              role: 'Tasker',
              clientName: userData?.first_name && userData?.last_name
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                : "Unknown Client",
            };
          }
  
          else {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.client_id)
              .maybeSingle();
  
            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }
  
            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
            date: task.created_at || new Date().toISOString().split("T")[0],
            remarks: task.remark || "No description provided",
            role: 'Client',
            clientName: userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
              : "Unknown Client",
            };
          }
        }));
      };
  
      // Try client_id first
      let formattedData = await fetchTasks('client_id');
  
      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks('tasker_id');
      }
  
      // Return response
      res.status(200).json({
        message: formattedData.length 
          ? "Successfully fetched notifications" 
          : "No notifications found",
        data: formattedData,
      });
  
    } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
   } 
    
  static async getRejectedRequests(req: Request, res: Response): Promise<any> {
      try {
        const userID = req.params.userId;
        console.log("User ID:", userID);
    
        if (!userID) {
          res.status(400).json({ error: "User ID is required" });
          return;
        }
    
        // Function to fetch and format tasks
        const fetchTasks = async (column: 'client_id' | 'tasker_id') => {
          const { data: tasks, error } = await supabase
            .from("task_taken")
            .select("*")
            .eq(column, userID)
            .eq("task_status", "Rejected");
    
          if (error) {
            throw new Error(`Error fetching ${column} tasks: ${error.message}`);
          }
    
          if (!tasks?.length) {
            return [];
          }
    
          return Promise.all(tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();
    
            if (titleError) {
              console.error(`Title fetch error for task ${task.task_taken_id}: ${titleError.message}`);
            }
    
            // Fetch user data
          if(column === 'client_id') {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();
    
              if (userError) {
                console.error(`User fetch error for task`, task.task_taken_id, userError.message);
              }
    
              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: 'Tasker',
                clientName: userData?.first_name && userData?.last_name
                  ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                  : "Unknown Client",
              };
            }
    
            else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();
    
              if (userError) {
                console.error(`User fetch error for task`, task.task_taken_id, userError.message);
              }
    
              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
              date: task.created_at || new Date().toISOString().split("T")[0],
              remarks: task.remark || "No description provided",
              role: 'Client',
              clientName: userData?.first_name && userData?.last_name
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                : "Unknown Client",
              };
            }
          }));
        };
    
        // Try client_id first
        let formattedData = await fetchTasks('client_id');
    
        // If no client tasks, try tasker_id
        if (!formattedData.length) {
          formattedData = await fetchTasks('tasker_id');
        }
    
        // Return response
        res.status(200).json({
          message: formattedData.length 
            ? "Successfully fetched notifications" 
            : "No notifications found",
          data: formattedData,
        });
    
      } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
  } 
    
  static async getOngoingRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: 'client_id' | 'tasker_id') => {
        const { data: tasks, error } = await supabase
          .from("task_taken")
          .select("*")
          .eq(column, userID)
          .in("task_status", ["Ongoing", "Disputed"]);

        if (error) {
          throw new Error(`Error fetching ${column} tasks: ${error.message}`);
        }

        if (!tasks?.length) {
          return [];
        }

        return Promise.all(tasks.map(async (task) => {
          // Fetch task title
          const { data: titleData, error: titleError } = await supabase
            .from("post_task")
            .select("task_title")
            .eq("task_id", task.task_id)
            .maybeSingle();


          if (titleError) {
            console.error(`Title fetch error for task ${task.task_taken_id}: ${titleError.message}`);
          }

          // Fetch user data
        if(column === 'client_id') {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.tasker_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
              date: task.created_at || new Date().toISOString().split("T")[0],
              remarks: task.remark || "No description provided",
              role: 'Tasker',
              clientName: userData?.first_name && userData?.last_name
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                : "Unknown Client",
            };
          }

          else {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.client_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
            date: task.created_at || new Date().toISOString().split("T")[0],
            remarks: task.remark || "No description provided",
            role: 'Client',
            clientName: userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
              : "Unknown Client",
            };
          }
        }));
      };

      // Try client_id first
      let formattedData = await fetchTasks('client_id');

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks('tasker_id');
      }

      // Return response
      res.status(200).json({
        message: formattedData.length 
          ? "Successfully fetched notifications" 
          : "No notifications found",
        data: formattedData,
      });

    } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  } 

  static async getFinishRequests(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.userId;
      console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: 'client_id' | 'tasker_id') => {
        const { data: tasks, error } = await supabase
          .from("task_taken")
          .select("*")
          .eq(column, userID)
          .eq("task_status", "Completed");

        if (error) {
          throw new Error(`Error fetching ${column} tasks: ${error.message}`);
        }

        if (!tasks?.length) {
          return [];
        }

        return Promise.all(tasks.map(async (task) => {
          // Fetch task title

          const { data: titleData, error: titleError } = await supabase
            .from("post_task")
            .select("task_title")
            .eq("task_id", task.task_id)
            .maybeSingle();

          if (titleError) {
            console.error(`Title fetch error for task ${task.task_taken_id}: ${titleError.message}`);
          }

          // Fetch user data
        if(column === 'client_id') {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.tasker_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
              date: task.created_at || new Date().toISOString().split("T")[0],
              remarks: task.remark || "No description provided",
              role: 'Tasker',
              clientName: userData?.first_name && userData?.last_name
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                : "Unknown Client",
            };
          }

          else {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.client_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
            date: task.created_at || new Date().toISOString().split("T")[0],
            remarks: task.remark || "No description provided",
            role: 'Client',
            clientName: userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
              : "Unknown Client",
            };
          }
        }));
      };

      // Try client_id first
      let formattedData = await fetchTasks('client_id');

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks('tasker_id');
      }

      // Return response
      res.status(200).json({
        message: formattedData.length 
          ? "Successfully fetched notifications" 
          : "No notifications found",
        data: formattedData,
      });

    } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  }

  static async getConfirmedRequests(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.userId;
      console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: 'client_id' | 'tasker_id') => {
        const { data: tasks, error } = await supabase
          .from("task_taken")
          .select("*")
          .eq(column, userID)
          .eq("task_status", "Confirmed");

        if (error) {
          throw new Error(`Error fetching ${column} tasks: ${error.message}`);
        }

        if (!tasks?.length) {
          return [];
        }

        return Promise.all(tasks.map(async (task) => {
          // Fetch task title

          const { data: titleData, error: titleError } = await supabase
            .from("post_task")
            .select("task_title")
            .eq("task_id", task.task_id)
            .maybeSingle();

          if (titleError) {
            console.error(`Title fetch error for task ${task.task_taken_id}: ${titleError.message}`);
          }

          // Fetch user data
        if(column === 'client_id') {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.tasker_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
              date: task.created_at || new Date().toISOString().split("T")[0],
              remarks: task.remark || "No description provided",
              role: 'Tasker',
              clientName: userData?.first_name && userData?.last_name
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
                : "Unknown Client",
            };
          }

          else {
            const { data: userData, error: userError } = await supabase
              .from("user")
              .select("first_name, last_name, middle_name")
              .eq("user_id", task.client_id)
              .maybeSingle();

            if (userError) {
              console.error(`User fetch error for task`, task.task_taken_id, userError.message);
            }

            return {
              id: task.task_taken_id,
              title: titleData?.task_title || "Untitled Task",
              status: task.task_status || "Pending",
            date: task.created_at || new Date().toISOString().split("T")[0],
            remarks: task.remark || "No description provided",
            role: 'Client',
            clientName: userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
              : "Unknown Client",
            };
          }
        }));
      };

      // Try client_id first
      let formattedData = await fetchTasks('client_id');

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks('tasker_id');
      }

      // Return response
      res.status(200).json({
        message: formattedData.length 
          ? "Successfully fetched notifications" 
          : "No notifications found",
        data: formattedData,
      });

    } catch (error) {
      console.error("Unexpected error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  }

  static async getTaskerRequestById(req: Request, res: Response): Promise<void> {
    const requestId = req.params.requestId;

    if (!requestId) {
      res.status(400).json({ error: "Request ID is required." });
      return;
    }

    const { data, error } = await supabase
      .from("task_taken")
      .select("*")
      .eq("task_taken_id", requestId)
      .maybeSingle();

    

    if (error) {
      console.error(error.message);
      res.status(500).json({ error: "An Error Occurred while fetching the request." });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Request not found." });
      return;
    }

    const updateVisit = await supabase.from("task_taken").update({ visit: true }).eq("task_taken_id", requestId);
  console.log("Fetched request:", data);
    res.status(200).json({ request: data });
  }


 static async updateRequest(req: Request, res: Response): Promise<void> {
  const taskTakenId = req.params.taskTakenId;
  const { value, role, client_id } = req.body;
  console.log("Role:", req.body);
  console.log("Task Taken ID:", taskTakenId);
  console.log("Value:", value);
  console.log("Role:", role);

  if (!taskTakenId) {
    res.status(400).json({ error: "Task Taken ID is required." });
    return;
  }

  let visit_client = false;
  let visit_tasker = false;

  
  if (role == "Client") {
    visit_client = true;
    visit_tasker = false;
  } else {
    visit_client = false;
    visit_tasker = true;
  }

  switch (value) {
    case 'Accept':
    
      const { error: acceptError } = await supabase
        .from("task_taken")
        .update({ task_status: "Confirmed", visit_client: visit_client, visit_tasker: visit_tasker })
        .eq("task_taken_id", taskTakenId);

        console.log("Accept request value: $value");

      if (acceptError) {
        console.error(acceptError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while accepting the request." });
        return;
      }
      break;
    case 'Start':
      const { error: startError } = await supabase
        .from("task_taken")
        .update({ task_status: "Ongoing", visit_client: visit_client, visit_tasker: visit_tasker })
        .eq("task_taken_id", taskTakenId);

      console.log("Start request value: $value");

      if (startError) {
        console.error(startError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while starting the request." });
        return;
      }
      break;
    case 'Reject':
      const { error: rejectError } = await supabase
        .from("task_taken")
        .update({ task_status: "Rejected", visit_client: visit_client, visit_tasker: visit_tasker })
        .eq("task_taken_id", taskTakenId);

        console.log("Reject request value: $value");

        if (rejectError) {
          console.error(rejectError.message);
          res.status(500).json({ success: false, error: "An Error Occurred while rejecting the request." });
          return;
        }
        break;
    case 'Disputed':
      const { error: disputeError } = await supabase
        .from("task_taken")
        .update({ task_status: "Disputed", visit_client: visit_client, visit_tasker: visit_tasker })
        .eq("task_taken_id", taskTakenId);

      if (disputeError) {
        console.error(disputeError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while disputing the request." });
        return;
      }
      break;
    case 'Finish':
      console.log("Hi");

      const task = await taskModel.getTaskAmount(parseInt(taskTakenId));
      console.log("Task data:", task);
      console.log("Proposed Price:", task?.post_task.proposed_price);
      
      // ... rest of your code

      await PayMongoPayment.releasePayment({
        client_id: task?.post_task.client_id,
        transaction_id: "Id from Xendit", //Temporary value
        amount: task?.post_task.proposed_price ?? 0,
        payment_type: "Release of Payment to Tasker",
        deposit_date: new Date().toISOString(),
      });

      const { error: finishError } = await supabase
        .from("task_taken")
        .update({ task_status: "Completed", visit_client: visit_client, visit_tasker: visit_tasker })
        .eq("task_taken_id", taskTakenId);

      console.log("Finish request value:", value);

      if (finishError) {
        console.error(finishError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while finishing the request." });
        return;
      }

      console.log(task?.tasker.tasker_id, task?.post_task.proposed_price);

      //const {data: reviewData, error: reviewError} = await supabase.from("task_review").select("").eq

      const { error: updateAmountError } = await supabase
        .rpc('update_tasker_amount', {
          addl_credits: task?.post_task.proposed_price, 
          id: task?.tasker.tasker_id,
        });

      if (updateAmountError) {
        console.error(updateAmountError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while updating tasker amount." });
        return;
      }
      break;
    default:
      res.status(400).json({ success: false, error: "Invalid value. Use 'Accept', 'Start', 'Disputed', or 'Finish'" });
      return;
  }

  res.status(200).json({ success: true, message: "Successfully Updated the Task Status." });
}

static async  updateNotification(req: Request, res: Response): Promise<void> {
  const taskTakenId = req.params.taskTakenId;

  if (!taskTakenId) {
    res.status(400).json({ error: "Task Taken ID is required." });
    return;
  }

  const { error } = await supabase
    .from("task_taken")
    .update({ visit_client: true, visit_tasker: true })
    .eq("task_taken_id", taskTakenId);

  if (error) {
    console.error(error.message);
    res.status(500).json({ error: "An Error Occurred while updating the notification." });
    return;
  }

  res.status(200).json({ success: true, message: "Notification updated successfully." });
}
}

export default NotificationController;
