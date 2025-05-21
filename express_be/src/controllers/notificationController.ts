import { Request, Response } from "express";
import { supabase } from "../config/configuration";
import { error } from "console";
import PayMongoPayment from "../models/paymentModel";
import taskModel from "../models/taskModel";
import TaskAssignment from "../models/taskAssignmentModel";

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

   
   static async getCancelledRequests(req: Request, res: Response): Promise<any> {
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
          .eq("task_status", "Cancelled");
  
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
              status: task.task_status || "Cancelled",
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
              status: task.task_status || "Cancelled",
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
   

  static async getReviewRequests(req: Request, res: Response): Promise<any> {
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
          .in("task_status", ["Review", "Disputed", "Dispute Settled"]);

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
          .in("task_status", ["Ongoing", "Disputed", "Review"]);

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

  
  static async getDisputedSettledRequests(req: Request, res: Response): Promise<void> {
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
          .eq("task_status", "Dispute Settled");

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
              status: task.task_status || "Disputed",
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
              status: task.task_status || "Dispute Settled",
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

  static async getDisputedRequests(req: Request, res: Response): Promise<void> {
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
          .eq("task_status", "Disputed");

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
              status: task.task_status || "Disputed",
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
              status: task.task_status || "Disputed",
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
  const taskTakenId = parseInt(req.params.taskTakenId);
  const { value, role, reason_for_dispute, dispute_details } = req.body;
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
      await TaskAssignment.updateStatus(taskTakenId, "Confirmed", visit_client, visit_tasker);
      break;
    case 'Start':
      await TaskAssignment.updateStatus(taskTakenId, "Ongoing", visit_client, visit_tasker);

      const { data: taskData, error: taskError } = await supabase
      .from("task_taken")
      .select("*")
      .eq("task_taken_id", taskTakenId)
      .maybeSingle();

    if (taskError) {
      console.error(taskError.message);
      res.status(500).json({ success: false, error: "An Error Occurred while starting the request." });
      return;
    }

    const { data: postTaskData, error: postTaskError } = await supabase
      .from("post_task")
      .update({ status: "Already Taken" })
      .eq("task_id", taskData.task_id)
      .maybeSingle();

    if (postTaskError) {
      console.error(postTaskError.message);
      res.status(500).json({ success: false, error: "An Error Occurred while starting the request." });
      return;
    }
      break;
    case 'Reject':
      await TaskAssignment.updateStatus(taskTakenId, "Rejected", visit_client, visit_tasker);
      break;
    case 'Review':
      await TaskAssignment.updateStatus(taskTakenId, "Review", visit_client, visit_tasker);
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
    case 'Cancel':
      await TaskAssignment.updateStatus(taskTakenId, "Cancelled", visit_client, visit_tasker);
      break;
    case 'Disputed':
      await TaskAssignment.updateStatus(taskTakenId, "Disputed", visit_client, visit_tasker);

      const imageEvidence = req.files as Express.Multer.File[];
      console.log("Image Evidence:", imageEvidence);

      let imageProof: string[] = [];
      if (imageEvidence && imageEvidence.length > 0) {
        for (const file of imageEvidence) {
          // Validate file mimetype or content
          const validImageTypes = ["image/jpeg", "image/png", "image/gif", "application/octet-stream"];
          let contentType = file.mimetype;

          // Check file signature for octet-stream
          if (file.mimetype === "application/octet-stream") {
            const isJpeg = file.buffer.subarray(0, 4).toString("hex").startsWith("ffd8ff");
            const isPng = file.buffer.subarray(0, 8).toString("hex").startsWith("89504e470d0a1a0a");
            const isGif = file.buffer.subarray(0, 6).toString("hex").startsWith("47494638");

            if (isJpeg) {
              contentType = "image/jpeg";
            } else if (isPng) {
              contentType = "image/png";
            } else if (isGif) {
              contentType = "image/gif";
            } else {
              console.error(`Invalid file content for: ${file.originalname}`);
              res.status(400).json({
                success: false,
                message: `Invalid file content. Only JPEG, PNG, and GIF are allowed.`,
              });
              return;
            }
          }

          if (!validImageTypes.includes(file.mimetype)) {
            console.error(`Invalid file type: ${file.mimetype}`);
            res.status(400).json({
              success: false,
              message: `Invalid file type. Only JPEG, PNG, and GIF are allowed.`,
            });
            return;
          }

          const fileName = `dispute_proof/${Date.now()}_${file.originalname}`;
          const { data, error } = await supabase.storage
            .from("documents")
            .upload(fileName, file.buffer, {
              contentType: contentType,
              cacheControl: "3600",
              upsert: false,
            });

          if (error) {
            console.error("Error uploading image:", error);
            res.status(500).json({
              success: false,
              message: "Error uploading images",
            });
            return;
          }

          console.log("Image uploaded successfully:", data);

          const { data: publicUrlData } = supabase.storage
            .from("documents")
            .getPublicUrl(fileName);

          imageProof.push(publicUrlData.publicUrl);
        }

        console.log("Image Proof:", imageProof);
        await TaskAssignment.createDispute(taskTakenId, reason_for_dispute, dispute_details, imageProof);
        break;
      } else {
        console.log("No image evidence provided");
        await TaskAssignment.createDispute(taskTakenId, reason_for_dispute, dispute_details, imageProof);
        break;
      }
    case 'Finish':
      console.log("Hi");
  
      if(role == "Tasker"){
        await TaskAssignment.updateStatus(taskTakenId, "Review", visit_client, visit_tasker);
      }else{
        const task = await taskModel.getTaskAmount(taskTakenId);
        console.log("Task data:", task);
        console.log("Proposed Price:", task?.post_task.proposed_price);
  
        // await PayMongoPayment.releasePayment({
        //   client_id: task?.post_task.client_id,
        //   transaction_id: "Id from Xendit", //Temporary value
        //   amount: task?.post_task.proposed_price ?? 0,
        //   payment_type: "Release of Payment to Tasker",
        //   deposit_date: new Date().toISOString(),
        // });
  
        await TaskAssignment.updateStatus(taskTakenId, "Completed", visit_client, visit_tasker, undefined, true);
  
        //console.log(task?.tasker.tasker_id, task?.post_task.proposed_price);
  
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
      }
    default:
      res.status(400).json({ success: false, error: "Invalid value. Use 'Accept', 'Start', 'Disputed', or 'Finish'" });
      return;
  }

  res.status(200).json({ success: true, message: "Successfully Updated the Task Status." });
}

static async    updateNotification(req: Request, res: Response): Promise<void> {
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
