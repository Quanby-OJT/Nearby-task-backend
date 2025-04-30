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

  /**
   * All Disputes were retrieved here.
   * @returns 
   */

  static async getAllDisputes() {
    const { data, error } = await supabase
      .from("dispute_logs")
      .select(`
      dispute_id,
      task_taken(
        task_taken_id,
        clients(
          user(
            first_name,
            middle_name,
            last_name,
            user_role
          )
        ),
        post_task(
          task_id,
          task_title
        )
      ),
      reason_for_dispute,
      dispute_details,
      image_proof,
      moderator_action,
      addl_dispute_notes,
      created_at::date
      `)
      .order("created_at", { ascending: false });

    //console.log("Dispute Data:" + data, "Dispute Errors: " + error)

    if (error) throw new Error(error.message)

    return data;
  }

  static async updateADispute(task_taken_id: number, task_status: string, dispute_id: number, moderator_action: string, addl_dispute_notes: Text, moderator_id: number){
    const {error: disputeError} = await supabase.from('dispute_logs').
      update({
        moderator_action,
        addl_dispute_notes,
        moderator_id
      }).
      eq('dispute_id', dispute_id)

    if(disputeError) throw new Error(disputeError.message);

    const {error: taskTakenError} = await supabase.from('task_taken').
      update({
        task_status
      })
      .eq("task_taken_id", task_taken_id)

    if(taskTakenError) throw new Error(taskTakenError.message)
  }

  static async deleteDispute(dispute_id: number){
    const {error} = await supabase.from("dispute_logs").update({is_archived: true}).eq("dispute_id", dispute_id)

    if(error) throw new Error(error.message)
  }
}

export default ClientTaskerModeration;