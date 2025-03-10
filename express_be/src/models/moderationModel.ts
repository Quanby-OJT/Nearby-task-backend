import { supabase } from "../config/configuration";

class ClientTaskerModeration{
    static async updateTaskerStatus(tasker_id: number, approved: boolean){
        const { data, error } = await supabase
            .from("document_verification")
            .update({ approved: approved })
            .eq("tasker_id", tasker_id)
            .select();

        if (error) throw error;
        return data;
    }
}

export default ClientTaskerModeration;