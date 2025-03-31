import { supabase } from "../config/configuration";

class TaskModel {
  async createNewTask(
    client_id: number,
    description: string,
    duration: number,
    job_title: string,
    urgency: boolean,
    location: string,
    num_of_days: string,
    specialization: string,
    contact_price: number,
    remarks: string,
    task_begin_date: string,
    user_id?: number,
    work_type?: string 
  ) {
    let statuses: string = "Available";
    console.log(
      "Creating task with data:",
      client_id,
      description,
      duration,
      job_title,
      urgency,
      location,
      num_of_days,
      specialization,
      contact_price,
      remarks,
      task_begin_date,
      user_id,
      work_type,
      statuses
    );

    const { data: existingClient, error: clientError } = await supabase
      .from("clients")
      .select("client_id")
      .eq("client_id", client_id)
      .single();

    if (clientError && clientError.code !== "PGRST116") {
      console.error("Error checking client existence:", clientError);
      throw new Error(clientError.message);
    }

    // Step 2: If the client doesn't exist, insert a new client
    if (!existingClient) {
      const newClient = {
        client_id: client_id,
        user_id: user_id || client_id,
        preferences: "Default preferences",
        client_address: location || "Unknown address",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertClientError } = await supabase
        .from("clients")
        .insert([newClient]);

      if (insertClientError) {
        console.error("Error inserting new client:", insertClientError);
        throw new Error(insertClientError.message);
      }

      console.log(`Inserted new client with client_id: ${client_id}`);
    }

    // Step 3: Insert the task
    const { data, error } = await supabase.from("post_task").insert([
      {
        client_id,
        task_title: job_title,
        task_description: description,
        duration: duration,
        proposed_price: contact_price,
        urgent: urgency,
        remarks: remarks,
        task_begin_date: task_begin_date,
        period: num_of_days,
        location: location,
        specialization: specialization,
        status: statuses,
        work_type: work_type
      },
    ]);

    if (error) {
      console.error("Supabase insertion error:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async showTaskforClient(client_id: number) {
    const { data, error } = await supabase
      .from("post_task")
      .select("*")
      .eq("client_id", client_id);

    if (error) throw new Error(error.message);
    return data;
  }

  async getAllTasks() {
    const { data, error } = await supabase.from("post_task").select(`
      *,
      clients:client_id (
        client_id,
          user:user_id (
            user_id,
            first_name,
            middle_name,
            last_name
          )
         )
      `);
    if (error) throw new Error(error.message);
    return data;
  }

  async getTaskById(jobPostId: number) {
    const { data, error } = await supabase
      .from("post_task")
      .select("*")
      .eq("task_id", jobPostId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getTasksByClientId(clientId: number) {
    const { data, error } = await supabase
      .from("post_task")
      .select("*")
      .eq("client_id", clientId);

    if (error) {
      console.error("Error fetching tasks by client ID:", error);
      throw new Error(error.message);
    }
    
    return data;
  }

  async deleteTask(taskId: number) {
    const { error } = await supabase
      .from("post_task")
      .delete()
      .eq("task_id", taskId);

     // .update({ status: "disabled" })
     //.eq("task_id", jobPostId)

    if (error) throw new Error(error.message);
    return { success: true, message: "Task deleted successfully" };
  }

  async updateTask(taskId: number, taskData: any) {
    console.log("Updating task:", taskId, taskData);
    
    // Remove any fields that should not be updated
    const cleanedData = { ...taskData };
    delete cleanedData.task_id; // Don't update primary key
    delete cleanedData.client_id; // Don't update client_id
    
    console.log("Cleaned data for update:", cleanedData);
    
    const { data, error } = await supabase
      .from("post_task")
      .update(cleanedData)
      .eq("task_id", taskId)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      throw new Error(error.message);
    }
    
    return { success: true, message: "Task updated successfully", task: data };
  }
}

const taskModel = new TaskModel();
export default taskModel;