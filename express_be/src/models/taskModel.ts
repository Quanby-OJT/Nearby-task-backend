import { supabase } from "../config/configuration";

class TaskModel  {
  
  async createNewTask(client_id: number, description: string, duration: string, job_title: string, urgency: boolean, location: string, num_of_days: number, specialization: string, contact_price: string, remarks: string, task_begin_date: string) {
    let statuses: string = "Pending";
    console.log("Creating task with data:", client_id, description, duration, job_title, urgency, location, num_of_days, specialization, contact_price, remarks, task_begin_date);
    const { data, error } = await supabase.from('tasks').insert([
      {
        client_id,
        task_title: job_title,
        task_description: description,
        duration: duration,
        contact_price: contact_price,
        urgent: urgency,
        remarks: remarks,
        task_begin_date: task_begin_date,
        period: num_of_days,
        location: location,
        specialization: specialization,
        status: statuses,
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
}

const taskModel = new TaskModel();
export default taskModel;
