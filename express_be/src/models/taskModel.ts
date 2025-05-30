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
      .eq("user_id", client_id)
      .single();

    if (clientError && clientError.code !== "PGRST116") {
      console.error("Error checking client existence:", clientError);
      throw new Error(clientError.message);
    }

    if (!existingClient) {
      console.error("Client not found for user_id:", client_id);
      throw new Error("Client not found for user_id");
    }

    console.log("Client ID:", existingClient.client_id);

    const { data: deductCredits, error: deductError } = await supabase.rpc('deduct_nearbytask_credits', { _client_id: existingClient.client_id, deduct_credits: contact_price });
    if (deductError) {
      console.error("Error deducting credits:", deductError);
      throw new Error(deductError.message);
    }
    console.log("Credits deducted successfully:", deductCredits);

    // Step 3: Insert the task
    const { data, error } = await supabase.from("post_task").insert([
      {
        client_id: existingClient.client_id,
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
      ),
      action_by_user:user!action_by (
        user_id,
        first_name,
        middle_name,
        last_name
      ),
      action_taken_by:action_taken_by!task_id (
        action_reason,
        user_id
      )
    `).order('task_id', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async getTaskById(jobPostId: number) {
    const { data, error } = await supabase
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

  async getAssignedTask(task_taken_id: number){
    // Get the main task data without tasker table references
    const { data, error } = await supabase.from("task_taken").
      select(`
        task_taken_id, 
        tasker_id,
        post_task!task_id (*),
        task_status,
        reason_for_rejection_or_cancellation
        `
      ).
      eq("task_taken_id", task_taken_id).
      single();
      
    if (error) throw new Error(error.message);
    
    // Get user basic info
    let userData = null;
    if (data?.tasker_id) {
      const { data: user, error: userError } = await supabase
        .from("user")
        .select("first_name, middle_name, last_name, email")
        .eq("user_id", data.tasker_id)
        .maybeSingle();
        
      if (userError) {
        console.warn("User Query Warning:", userError.message);
      } else {
        userData = user;
      }
    }
    
    // Get bio and social_media_links from user_verify table
    let verifyData = null;
    if (data?.tasker_id) {
      const { data: verify, error: verifyError } = await supabase
        .from("user_verify")
        .select("bio, social_media_links")
        .eq("user_id", data.tasker_id)
        .maybeSingle();
        
      if (verifyError) {
        console.warn("User Verify Query Warning:", verifyError.message);
      } else {
        verifyData = verify;
      }
    }
    
    // Combine the data (simplified structure without tasker table data)
    const result = {
      ...data,
      tasker: {
        user: userData || { first_name: '', middle_name: '', last_name: '', email: '' },
        bio: verifyData?.bio || '',
        social_media_links: verifyData?.social_media_links || '{}'
      }
    };
    
    console.log(result, error);
    return result;
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

  async updateTaskStatus(taskId: number, status: string, taskTakenStatus: string) {
    const { error: taskError } = await supabase
      .from("post_task")
      .update({ status })
      .eq("task_id", taskId)

    const { error: taskTakenError } = await supabase
      .from("task_taken")
      .update({ task_status: taskTakenStatus })
      .eq("task_id", taskId)

    if (taskError || taskTakenError) {
      const errorMessage = `${taskError?.message || ''}${taskTakenError?.message || ''}`.trim();
      throw new Error(errorMessage);
    }
  }

  async getTaskAmount(taskTakenId: number) {
    interface TaskTakenResponse {
      task_id: number;
      post_task: {
        client_id: number;
        proposed_price: number;
      };
      tasker: {
        tasker_id: number;
      };
    }
    const { data, error } = await supabase
      .from('task_taken')
      .select(`
        task_id,
        post_task (
          client_id,
          proposed_price
        ),
        tasker (
          tasker_id
        )
      `)
      .eq('task_taken_id', taskTakenId)
      .single() as { data: TaskTakenResponse | null; error: any };
  
    if (error) throw new Error(error.message);
    return data;
  }

  async getTaskWithSpecialization(specialization: string) {
    const { data, error } = await supabase
      .from("post_task")
      .select("*")
      .eq("specialization", specialization);

    if (error) throw new Error(error.message);
    return data;
  }

  async disableTask(taskId: number) {
    const { data, error } = await supabase
      .from("post_task")
      .update({ status: "Closed" })
      .eq("task_id", taskId)
      .select()
      .single();
  
    if (error) {
      console.error("Error disabling task in model:", error);
      throw new Error(error.message);
    }
  
    return { success: true, message: "Task closed successfully", task: data };
  }

}

const taskModel = new TaskModel();
export default taskModel;