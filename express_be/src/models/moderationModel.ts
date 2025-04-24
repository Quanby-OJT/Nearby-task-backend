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
}

export default ClientTaskerModeration;