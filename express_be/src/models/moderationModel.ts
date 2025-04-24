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

    static async banUser(userId: number): Promise<boolean> {
        try {
          const { data, error } = await supabase
            .from("user")
            .update({ acc_status: "Ban" })
            .eq("user_id", userId)
            .select()
            .single();
    
          if (error) {
            console.error("Supabase update error (banUser):", error);
            throw error;
          }
    
          if (!data) {
            console.log(`User with ID ${userId} not found`);
            return false;
          }
    
          console.log(`User with ID ${userId} has been banned`);
          return true;
        } catch (error) {
          console.error("Error in banUser:", error);
          throw error;
        }
      }
    
    static async warnUser(userId: number): Promise<boolean> {
      try {
        const { data, error } = await supabase
          .from("user")
          .update({ acc_status: "Warn" })
          .eq("user_id", userId)
          .select()
          .single();
  
        if (error) {
          console.error("Supabase update error (warnUser):", error);
          throw error;
        }
  
        if (!data) {
          console.log(`User with ID ${userId} not found`);
          return false;
        }
  
        console.log(`User with ID ${userId} has been warned`);
        return true;
      } catch (error) {
        console.error("Error in warnUser:", error);
        throw error;
      }
    }

    static async openADispute(task_taken_id: number): Promise<boolean> {
      try {
        const { data, error } = await supabase
          .from("task_taken")
          .update({ task_status: "Dispute" })
          .eq("task_taken_id", task_taken_id)
          .select()
          .single();
  
        if (error) {
          console.error("Supabase update error (openADispute):", error);
          throw error;
        }
  
        if (!data) {
          console.log(`Task with ID ${task_taken_id} not found`);
          return false;
        }
  
        console.log(`Dispute has been opened for task with ID ${task_taken_id}`);
        return true;
      } catch (error) {
        console.error("Error in openADispute:", error);
        throw error;
      }
    }
    static async getAllDisputes() {
        const { data, error } = await supabase
            .from("task_taken")
            .select(`
                task_taken_id,
                task_status::text,
                post_task!task_id (task_id, task_title),
                clients!client_id (user!user_id (first_name, middle_name, last_name)),
                tasker!tasker_id (user!user_id (first_name, middle_name, last_name))
            `)
            .eq("task_status", "Disputed")
            .eq("is_deleted", false);

        if (error) throw error;
        return data;
    }
    static async getDispute(task_taken_id: number) {
        const { data, error } = await supabase
            .from("task_taken")
            .select(`
                task_taken_id,
                task_status::text,
                post_task!task_id (task_id, task_title),
                clients!client_id (user!user_id (first_name, middle_name, last_name)),
                tasker!tasker_id (user!user_id (first_name, middle_name, last_name))
            `)
            .eq("task_taken_id", task_taken_id)
            .eq("is_deleted", false);

        if (error) throw error;
        return data;
    }
}

export default ClientTaskerModeration;