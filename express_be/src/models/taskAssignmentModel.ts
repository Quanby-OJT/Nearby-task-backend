import {supabase} from "../config/configuration";

class TaskAssignment{
    static async assignTask(assignedTask: {tasker_id: number, client_id: number, task_id: number, task_status: string}){
        const {data, error} = await supabase.from("task_taken").insert([assignedTask])

        if(error) throw new Error(error.message)

        return data
    }

    static async updateStatus(status: {task_status: string, reason_for_rejection_or_cancellation: string}){
        const {data, error} = await supabase.from("task_taken").insert([status])

        if(error) throw new Error(error.message)

        return data
    }
}

export {TaskAssignment}