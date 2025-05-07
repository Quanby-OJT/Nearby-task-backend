import { supabase } from "../config/configuration";
import UserWithTasksModel from "./userClientModel";


export class TaskModel {
  task_id: number;
  task_title: string;
  task_description: string;
  duration: number;
  proposed_price: number;
  urgent: boolean;
  remarks: string;
  client_id: number;
  task_begin_date: string;
  period: string;
  location: string;
  specialization: string;
  status: string;
  work_type: string;
  created_at: string;
  updated_at: string | null;
  clients: {
    client_id: number;
    user: {
      user_id: number;
      first_name: string;
      middle_name: string | null;
      last_name: string;
      image_link: string | null;
      birthdate: string | null;
      acc_status: string;
      gender: string | null;
      email: string | null;
      contact: string | null;
      verified: boolean;
      user_role: string;
      user_preference: {
        id: number;
        latitude: number;
        longitude: number;
        distance: number;
        specialization: string;
        age_start: number;
        age_end: number;
        limit: number;
        created_at: string;
        updated_at: string | null;
        address: {
          id: number;
          barangay: string;
          city: string;
          province: string;
          postal_code: string;
          country: string;
          street: string;
          latitude: number;
          longitude: number;
          default: boolean;
          created_at: string;
          updated_at: string | null;
        } | null;
      } | null;
    };
  } | null;

  constructor(data: any = {}) {
    this.task_id = data?.task_id;
    this.task_title = data?.task_title;
    this.task_description = data?.task_description;
    this.duration = data?.duration;
    this.proposed_price = data?.proposed_price;
    this.urgent = data?.urgent;
    this.remarks = data?.remarks;
    this.client_id = data?.client_id;
    this.task_begin_date = data?.task_begin_date;
    this.period = data?.period;
    this.location = data?.location;
    this.specialization = data?.specialization;
    this.status = data?.status;
    this.work_type = data?.work_type;
    this.created_at = data?.created_at;
    this.updated_at = data?.updated_at;
    this.clients = data?.clients
      ? {
          client_id: data.clients.client_id,
          user: {
            user_id: data.clients.user.user_id,
            first_name: data.clients.user.first_name,
            middle_name: data.clients.user.middle_name,
            last_name: data.clients.user.last_name,
            image_link: data.clients.user.image_link,
            birthdate: data.clients.user.birthdate,
            acc_status: data.clients.user.acc_status,
            gender: data.clients.user.gender,
            email: data.clients.user.email,
            contact: data.clients.user.contact,
            verified: data.clients.user.verified,
            user_role: data.clients.user.user_role,
            user_preference: data.clients.user.user_preference
              ? {
                  id: data.clients.user.user_preference.id,
                  latitude: data.clients.user.user_preference.latitude,
                  longitude: data.clients.user.user_preference.longitude,
                  distance: data.clients.user.user_preference.distance,
                  specialization: data.clients.user.user_preference.specialization,
                  age_start: data.clients.user.user_preference.age_start,
                  age_end: data.clients.user.user_preference.age_end,
                  limit: data.clients.user.user_preference.limit,
                  created_at: data.clients.user.user_preference.created_at,
                  updated_at: data.clients.user.user_preference.updated_at,
                  address: data.clients.user.user_preference.address
                    ? {
                        id: data.clients.user.user_preference.address.id,
                        barangay: data.clients.user.user_preference.address.barangay,
                        city: data.clients.user.user_preference.address.city,
                        province: data.clients.user.user_preference.address.province,
                        postal_code: data.clients.user.user_preference.address.postal_code,
                        country: data.clients.user.user_preference.address.country,
                        street: data.clients.user.user_preference.address.street,
                        latitude: data.clients.user.user_preference.address.latitude,
                        longitude: data.clients.user.user_preference.address.longitude,
                        default: data.clients.user.user_preference.address.default,
                        created_at: data.clients.user.user_preference.address.created_at,
                        updated_at: data.clients.user.user_preference.address.updated_at,
                      }
                    : null,
                }
              : null,
          },
        }
      : null;
  }

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
    const { data, error } = await supabase
      .from("post_task")
      .select(`
        *,
        clients!post_task_client_id_fkey (
          client_id,
          user!clients_user_id_fkey (
            user_id,
            first_name,
            middle_name,
            last_name,
            image_link,
            birthdate,
            acc_status,
            gender,
            email,
            contact,
            verified,
            user_role,
            user_preference!user_preference_user_id_fkey (
              id,
              latitude,
              longitude,
              distance,
              specialization,
              age_start,
              age_end,
              limit,
              created_at,
              updated_at,
              address:user_address (
                id,
                barangay,
                city,
                province,
                postal_code,
                country,
                street,
                latitude,
                longitude,
                default,
                created_at,
                updated_at
              )
            )
          )
        )
      `)
      .order("task_id", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((task: any) => new TaskModel(task));
  }

  
  async getTaskById(jobPostId: number) {
    const { data, error } = await supabase  
      .from("post_task")
      .select("*, clients:client_id (user:user_id (user_id, first_name, middle_name, last_name), preferences, client_address)")
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
    const { data, error } = await supabase.from("task_taken").
      select(`
        task_taken_id, 
        tasker!tasker_id (user!user_id (first_name, middle_name, last_name, email), bio, tasker_specialization!specialization_id(specialization), skills, address, availability, wage_per_hour, pay_period, social_media_links, rating),
        post_task!task_id (*),
        task_status,
        reason_for_rejection_or_cancellation
        `
      ).
      eq("task_taken_id", task_taken_id).
      single();
      console.log(data, error);
    if (error) throw new Error(error.message);
    return data;
  }

  async deleteTask(taskId: number) {
    const { error } = await supabase
      .from("post_task")
      .delete()
      .eq("task_id", taskId);

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

const taskModel = new TaskModel({});
export default taskModel;