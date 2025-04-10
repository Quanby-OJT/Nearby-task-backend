import { Request, Response } from "express";
import { supabase } from "../config/configuration";
import { error } from "console";

class NotificationController {
 static async getTaskerRequest(req: Request, res: Response): Promise<any> {
  try {
    const userID = req.params.userId;
    console.log("Client ID:", userID);

    if (!userID) {
      res.status(400).json({ error: "Client ID is required." });
      return;
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("task_taken")
      .select("*")
      .eq("client_id", userID).eq("task_status", "Pending");

    if (tasksError) {
      console.error(tasksError.message);
      res.status(500).json({ error: "An Error Occurred while fetching notifications." });
      return;
    }

    if (!tasks || tasks.length === 0) {
      res.status(200).json({ message: "No notifications found", data: [] });
      return;
    }

    const { data, error } = await supabase
      .from("task_taken")
      .select("*")
      .eq("client_id", userID).eq("task_status", "Pending");

    if (error) {
      console.error(error.message);
      res.status(500).json({ error: "An Error Occurred while fetching notifications." });
      return;
    }

    if (!data || data.length === 0) {
      res.status(200).json({ message: "No notifications found", data: [] });
      return;
    }

    const formattedData = await Promise.all(
      data.map(async (task) => {
        // Fetch task title and description from post_task (expecting at most one row)

        console.log("Task Data:", task);
        console.log("Task ID:", task.task_id);
        const { data: titleData, error: titleError } = await supabase
          .from("post_task")
          .select("task_title")
          .eq("task_id", task.task_id)
          .maybeSingle();


        // Fetch user data from prawn user table (expecting at most one row)
        const { data: userData, error: userError } = await supabase
          .from("user")
          .select("first_name, last_name, middle_name")
          .eq("user_id", task.tasker_id)
          .maybeSingle(); // Changed from .single() to handle no rows

        if (userError) {
          console.error(
            "User fetch error for task",
            task.task_taken_id,
            userError.message
          );
        }

        // Format the data for this task
        return {
          id: task.task_taken_id,
          title: titleData?.task_title || "Untitled Task",
          status: task.task_status || "Pending",
          date: task.created_at || new Date().toISOString().split("T")[0],
          remarks: task.remark || "No description provided",
          clientName:
            userData?.first_name && userData?.last_name
              ? `${userData.first_name} ${userData.middle_name || ""} ${userData.last_name}`.trim()
              : "Unknown Client",
        };
      })
    );

    console.log("Fetched and formatted data:", formattedData);

    res.status(200).json({
      message: "Successfully fetched notifications",
      data: formattedData,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
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
        .eq("task_status", "Ongoing");

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


 static async acceptRequest(req: Request, res: Response): Promise<void> {
  const taskTakenId = req.params.taskTakenId;
  const { value } = req.body;

  if (!taskTakenId) {
    res.status(400).json({ error: "Task Taken ID is required." });
    return;
  }

  switch (value) {
    case 'Accept':
      const { error: acceptError } = await supabase
        .from("task_taken")
        .update({ task_status: "Confirmed" })
        .eq("task_taken_id", taskTakenId);

      if (acceptError) {
        console.error(acceptError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while accepting the request." });
        return;
      }
      break;
    case 'Start':
      const { error: startError } = await supabase
        .from("task_taken")
        .update({ task_status: "Ongoing" })
        .eq("task_taken_id", taskTakenId);

      if (startError) {
        console.error(startError.message);
        res.status(500).json({ success: false, error: "An Error Occurred while starting the request." });
        return;
      }
      break;
      case 'Finish':
        const { error: finishError } = await supabase
          .from("task_taken")
          .update({ task_status: "Completed" })
          .eq("task_taken_id", taskTakenId);
  
        if (finishError) {
          console.error(finishError.message);
          res.status(500).json({ success: false, error: "An Error Occurred while finishing the request." });
          return;
        }
        break;
    default:
      res.status(400).json({ error: "Invalid value. Use 'Accept', 'Start', or 'Finish'" });
      return;
  }

  res.status(200).json({ success: true, message: "Request accepted successfully." });
}
}

export default NotificationController;
