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

    static async updateStatus(task_taken_id: number, task_status: string, visit_client: boolean, visit_tasker: boolean, reason_for_rejection_or_cancellation?: string, payment_relased?: boolean, is_deleted?: boolean){
        const { error } = await supabase
        .from("task_taken")
        .update({ task_status: task_status, visit_client: visit_client, visit_tasker: visit_tasker, reason_for_rejection_or_cancellation: reason_for_rejection_or_cancellation, payment_released: payment_relased, is_deleted: is_deleted })
        .eq("task_taken_id", task_taken_id);

        if (error) throw new Error(error.message)
    }

    static async createDispute(task_taken_id: number, reason_for_dispute: string, dispute_details: string, image_proof: string[]){

        //TODO: Upload image_proof to Supabase Storage and get the URL

        const { data, error } = await supabase
            .from('dispute_logs')
            .insert({
                task_taken_id: task_taken_id, 
                reason_for_dispute: reason_for_dispute,
                dispute_details: dispute_details,
                image_proof: JSON.stringify(image_proof) // Convert array to JSONB string
            })

        if(error) throw new Error(error.message)
        return data
    }
}

export default TaskAssignment