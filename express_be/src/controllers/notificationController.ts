import { Request, Response } from "express";
import { supabase } from "../config/configuration";
import { error } from "console";
import QTaskPayment from "../models/paymentModel";
import taskModel from "../models/taskModel";
import TaskAssignment from "../models/taskAssignmentModel";
import { DateTime } from "luxon";

class NotificationController {
  /**
   * What is the point of having these many types of get requests based on the the task status when you can all join them in one method?
   */
  static async getTaskerRequest(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

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
        res
          .status(500)
          .json({ error: "An error occurred while fetching user data." });
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
                ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                  }`.trim()
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

        // console.log(`Fetched and formatted data for ${column}:`, formattedData);
        return formattedData;
      };

      // Fetch notifications based on role
      let formattedData: any[] = [];
      if (userData.user_role === "Client") {
        formattedData = await fetchRequest(
          userID,
          "client_id",
          "visit_client",
          "tasker_id"
        );
      } else if (userData.user_role === "Tasker") {
        formattedData = await fetchRequest(
          userID,
          "tasker_id",
          "visit_tasker",
          "client_id"
        );
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
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Rejected",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getCancelledRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Cancelled",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Cancelled",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getRejectedRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getReviewRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
        const { data: tasks, error } = await supabase
          .from("task_taken")
          .select("*")
          .eq(column, userID)
          .in("task_status", ["Review", "Disputed", "Completed"]);

        if (error) {
          throw new Error(`Error fetching ${column} tasks: ${error.message}`);
        }

        if (!tasks?.length) {
          return [];
        }

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getOngoingRequests(req: Request, res: Response): Promise<any> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title
            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getDisputedSettledRequests(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title

            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Disputed",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Completed",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getDisputedRequests(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title

            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Disputed",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Disputed",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getFinishRequests(req: Request, res: Response): Promise<void> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title

            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getConfirmedRequests(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const userID = req.params.userId;
      // console.log("User ID:", userID);

      if (!userID) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      // Function to fetch and format tasks
      const fetchTasks = async (column: "client_id" | "tasker_id") => {
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

        return Promise.all(
          tasks.map(async (task) => {
            // Fetch task title

            const { data: titleData, error: titleError } = await supabase
              .from("post_task")
              .select("task_title")
              .eq("task_id", task.task_id)
              .maybeSingle();

            if (titleError) {
              console.error(
                `Title fetch error for task ${task.task_taken_id}: ${titleError.message}`
              );
            }

            // Fetch user data
            if (column === "client_id") {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.tasker_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Tasker",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            } else {
              const { data: userData, error: userError } = await supabase
                .from("user")
                .select("first_name, last_name, middle_name")
                .eq("user_id", task.client_id)
                .maybeSingle();

              if (userError) {
                console.error(
                  `User fetch error for task`,
                  task.task_taken_id,
                  userError.message
                );
              }

              return {
                id: task.task_taken_id,
                title: titleData?.task_title || "Untitled Task",
                status: task.task_status || "Pending",
                date: task.created_at || new Date().toISOString().split("T")[0],
                remarks: task.remark || "No description provided",
                role: "Client",
                clientName:
                  userData?.first_name && userData?.last_name
                    ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name
                      }`.trim()
                    : "Unknown Client",
              };
            }
          })
        );
      };

      // Try client_id first
      let formattedData = await fetchTasks("client_id");

      // If no client tasks, try tasker_id
      if (!formattedData.length) {
        formattedData = await fetchTasks("tasker_id");
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
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  }

  static async getTaskerRequestById(
    req: Request,
    res: Response
  ): Promise<void> {
    const requestId = req.params.requestId;

    if (!requestId) {
      res.status(400).json({ error: "Request ID is required." });
      return;
    }

    const { data, error } = await supabase
      .from("task_taken")
      .select(`*, post_task:task_id (
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
            )`)
      .eq("task_taken_id", requestId)
      .maybeSingle();

    if (error) {
      console.error(error.message);
      res
        .status(500)
        .json({ error: "An Error Occurred while fetching the request." });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "Request not found." });
      return;
    }

    const updateVisit = await supabase
      .from("task_taken")
      .update({ visit: true })
      .eq("task_taken_id", requestId);
    //// console.log("Fetched request:", data);
    res.status(200).json({ request: data });
  }

  static async updateRequest(req: Request, res: Response): Promise<void> {
    const taskTakenId = parseInt(req.params.taskTakenId);
    const {
      value,
      role,
      reason_for_dispute,
      dispute_details,
      rejection_reason,
    } = req.body;
    console.log("Role:", req.body);
    console.log("Task Taken ID:", taskTakenId);
    console.log("Value:", value);
    console.log("Role:", role);
    console.log("Rejection Reason:", rejection_reason);
    const reason_for_rejection_or_cancellation = rejection_reason;

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
      case "Accept":
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Confirmed",
          visit_client,
          visit_tasker
        );

        const acceptedTask = await TaskAssignment.getTask(taskTakenId);

        await TaskAssignment.updateTaskStatus(acceptedTask.task_id, "Already Taken", false);
        
        break;
      case "Reworking":
        const rework = 1; 
        await TaskAssignment.updateStatus(
            taskTakenId,
            "Reworking",
            visit_client,
            visit_tasker, 
            undefined,
            false,
            false,
            undefined,
            rework
        );

        
        break;

        case "Expired":
        await TaskAssignment.updateStatus(
            taskTakenId,
            "Expired",
            visit_client,
            visit_tasker,
            undefined,
            false,
            false,
            undefined,
            undefined,
        );

        const dataExpired= await TaskAssignment.getTask(taskTakenId);

        await TaskAssignment.updateTaskStatus(dataExpired.task_id, "Available", true);

        
        break;
      case "Start":
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Ongoing",
          visit_client,
          visit_tasker
        );

        const data= await TaskAssignment.getTask(taskTakenId);

        await TaskAssignment.updateTaskStatus(data.task_id, "In Progress", false);

        break;
      case "Reject":
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Rejected",
          visit_client,
          visit_tasker,
          reason_for_rejection_or_cancellation
        );
        break;
      case "Declined":
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Declined",
          visit_client,
          visit_tasker,
          reason_for_rejection_or_cancellation
        );

        break;
      case "Review":
        const endDate = DateTime.now().setZone("Asia/Manila");
        const endDateISO = endDate.toISO();
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Review",
          visit_client,
          visit_tasker,
          reason_for_rejection_or_cancellation,
          undefined,
          undefined,
          endDateISO as string
        );
        break;
      case "Cancel":
        //This is 
        if(!reason_for_rejection_or_cancellation) {
          res.status(400).json({
            success: false,
            error: "Reason for cancellation is required.",
          });
          return;
        }

        const cancelledTask = await TaskAssignment.getTask(taskTakenId);

        // console.log("Cancelled Task:", cancelledTask);
        if(cancelledTask.task_status == "Confirmed") {
            await TaskAssignment.updateStatus(
            taskTakenId,
            "Cancelled",
            visit_client,
            visit_tasker,
            reason_for_rejection_or_cancellation
          );

          const taskAmount = await taskModel.getTaskAmount(taskTakenId);

          console.log("Task Amount:", taskAmount);

          if(!taskAmount) {
            res.status(404).json({
              success: false,
              error: "Task not found.",
            });
            return;
          }
        
          await QTaskPayment.refundCreditstoClient(taskAmount.task_id, taskTakenId)
          const data= await TaskAssignment.getTask(taskTakenId);

          await TaskAssignment.updateTaskStatus(data.task_id, "Available", true);
        }
        else {
          await TaskAssignment.updateStatus(
            taskTakenId,
            "Cancelled",
            visit_client,
            visit_tasker,
            reason_for_rejection_or_cancellation
          );

          const data= await TaskAssignment.getTask(taskTakenId);

          await TaskAssignment.updateTaskStatus(data.task_id, "Available", true);
        }

        
        break;
      case "Disputed":
        await TaskAssignment.updateStatus(
          taskTakenId,
          "Disputed",
          visit_client,
          visit_tasker
        );
      const imageEvidence = (req.files as { [fieldname: string]: Express.Multer.File[] })["imageEvidence"];


          console.log("Image Evidence:", imageEvidence);

          const imageProof: string[] = [];

          if (imageEvidence && Array.isArray(imageEvidence)) {
            for (const file of imageEvidence) {
              try {
                const fileName = `disputes/DISPUTE-${Date.now()}-${file.originalname}`;
                console.log(`Uploading file: ${fileName}`);

                const { error } = await supabase.storage.from("crud_bucket").upload(fileName, file.buffer, {
                  contentType: file.mimetype,
                  cacheControl: "3600",
                  upsert: true,
                });
                if (error) throw new Error(`Failed to upload file: ${error.message}`);

                const { data: disputeProof } = await supabase.storage
                  .from("crud_bucket")
                  .getPublicUrl(fileName);

                console.log(`File uploaded successfully: ${disputeProof.publicUrl}`);
                imageProof.push(disputeProof.publicUrl);
              } catch (err: any) {
                console.error(`Image skipped: ${file.originalname}`, err.message);
                res.status(400).json({
                  success: false,
                  error: `Image upload failed for ${file.originalname}: ${err.message}`,
                });
                return;
              }
            }

            console.log("Image Proof URLs:", imageProof);
            await TaskAssignment.createDispute(taskTakenId, reason_for_dispute, dispute_details, imageProof);
          } else {
            console.log("No image evidence provided, proceeding with text dispute.");
            await TaskAssignment.createDispute(taskTakenId, reason_for_dispute, dispute_details);
          }

        const taskData = await TaskAssignment.getTask(taskTakenId);
        await TaskAssignment.updateTaskStatus(taskData.task_id, "On Hold", false);
        break
      case "Finish":
        if (role == "Tasker") {
          await TaskAssignment.updateStatus(
            taskTakenId,
            "Review",
            visit_client,
            visit_tasker
          );
        } else {
          const task = await taskModel.getTaskAmount(taskTakenId);

          await TaskAssignment.updateStatus(
            taskTakenId,
            "Completed",
            visit_client,
            visit_tasker,
            reason_for_rejection_or_cancellation
          );

          const { error: updateAmountError } = await supabase.rpc(
            "increment_tasker_amount",
            {
              addl_credits: task?.post_task.proposed_price,
              id: task?.tasker.tasker_id,
            }
          );

          if (updateAmountError) {
            console.error(updateAmountError.message);
            res.status(500).json({
              success: false,
              error: "An Error Occurred while updating tasker amount.",
            });
            return;
          }

          const data= await TaskAssignment.getTask(taskTakenId);

          await TaskAssignment.updateTaskStatus(data.task_id, "Closed", true);
          break;
        }
      default:
        res.status(400).json({
          success: false,
          error:
            "Invalid value. Use 'Accept', 'Start', 'Disputed', or 'Finish'",
        });
        return;
    }

    res.status(200).json({
      success: true,
      message: "Successfully Updated the Task Status.",
    });
  }



  static async updateNotification(req: Request, res: Response): Promise<void> {
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
      res
        .status(500)
        .json({ error: "An Error Occurred while updating the notification." });
      return;
    }

    res
      .status(200)
      .json({ success: true, message: "Notification updated successfully." });
  }
}

export default NotificationController;
