import { supabase } from "../config/configuration";

class TaskModel {
  async createNewTask(
    description: string,
    duration: string,
    job_title: string,
    urgency: string,
    location: string,
    num_of_days: number,
    specialization: string,
    contact_price: string,
    remarks: string,
    task_begin_date: string,
    client_id: number // Added client_id as a parameter
  ) {
    let statuses: string = "active";
    const { data, error } = await supabase.from("tasks").insert([

      {
        client_id,
        task_title: job_title,
        task_description: description,
        duration: num_of_days,
        contact_price: contact_price,
        urgent: urgency,
        remarks: remarks,
        task_begin_date: task_begin_date,
        period: duration,
        location: location,
        specialization: specialization
      },
    ]);

    if (error) throw new Error(error.message);
    return data;
  }

  async showTaskforClient(client_id: number) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_id", client_id);

    if (error) throw new Error(error.message);
    return data;
  }

  async getAllTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        clients (
          *,
          user (
          *
          )
        )
      `);

    if (error) throw new Error(error.message);
    return data;
  }
  
  async getTaskById(jobPostId: number) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("task_id", jobPostId) 
      .single(); 

    if (error) throw new Error(error.message);
    return data;
  }

  async disableTask(jobPostId: number) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "disabled" })
      .eq("task_id", jobPostId);

    if (error) throw new Error(error.message);
    return { message: "Task disabled successfully" };
  }
}

const taskModel = new TaskModel();
export default taskModel;