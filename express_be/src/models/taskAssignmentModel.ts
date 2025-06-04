import {supabase} from "../config/configuration";

class TaskAssignment{
    static findOne(arg0: { where: { taskId: number; taskerId: number; }; }) {
      throw new Error("Method not implemented.");
    }
    static async assignTask(assignedTask: {tasker_id: number, client_id: number, task_id: number, task_status: string}){
        const {data, error} = await supabase.from("task_taken").insert([assignedTask])

        if(error) throw new Error(error.message)

        return data
    }

    static async updateStatus(task_taken_id: number, task_status: string, visit_client: boolean, visit_tasker: boolean, reason_for_rejection_or_cancellation?: string, payment_relased?: boolean, is_deleted?: boolean, end_date?: String, rework_count?: number){
        const { error } = await supabase
        .from("task_taken")
        .update({ task_status: task_status, visit_client: visit_client, visit_tasker: visit_tasker, reason_for_rejection_or_cancellation: reason_for_rejection_or_cancellation, payment_released: payment_relased, is_deleted: is_deleted, end_date: end_date, rework_count: rework_count})
        .eq("task_taken_id", task_taken_id);

        if (error) throw new Error(error.message)
    }

    static async updateTaskStatus(task_id: number, post_task_status: string, able_to_delete: boolean){
        const { error } = await supabase
        .from("post_task")
        .update({ status: post_task_status, able_to_delete: able_to_delete })
        .eq("task_id", task_id);

        if (error) throw new Error(error.message)
    }

    static async getTask(task_id: number): Promise<any> {  
        const { data: taskData, error: taskError } = await supabase
          .from("task_taken")
          .select("*")
          .eq("task_taken_id", task_id)
          .maybeSingle();

        if (taskError) throw new Error(taskError.message);

        return taskData;
    }

    static async createDispute(task_taken_id: number, reason_for_dispute: string, dispute_details: string, image_proof?: string[]){


        const { data, error } = await supabase
            .from('dispute_logs')
            .insert({
                task_taken_id: task_taken_id, 
                reason_for_dispute: reason_for_dispute,
                dispute_details: dispute_details,
                image_proof: image_proof // Convert array to JSONB string
            })

        if(error) throw new Error(error.message)
        return data
    }

    static async updateClientPostStatus(task_id: number, task_status: boolean): Promise<any> {
        const { error } = await supabase
        .from("post_task")
        .update({ able_to_delete: task_status })
        .eq("task_id", task_id);
        
        if(error) throw new Error(error.message)
        return { success: true, message: "Task status updated successfully." }
    }
    
}

export default TaskAssignment