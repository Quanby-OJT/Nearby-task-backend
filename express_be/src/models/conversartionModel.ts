import { supabase } from "../config/configuration";

class ConversationModel {
  static async getUserConversation() {
    try {
      console.log("Attempting to fetch conversation data...");
      const { data, error } = await supabase
        .from("conversation_history")
        .select(`
          convo_id,
          created_at,
          conversation,
          reported,
          user_id,
          user!user_id (
            first_name,
            middle_name,
            last_name,
            email,
            user_role,
            status,
            acc_status
          ),
          task_taken!task_taken_id (
            task_taken_id,
            created_at,
            task_status,
            client_id,
            clients!client_id (
              user_id,
              user!user_id (
                first_name,
                middle_name,
                last_name,
                email,
                user_role,
                status
              )
            ),
            tasker_id,
            tasker!tasker_id (
              user_id,
              user!user_id (
                first_name,
                middle_name,
                last_name,
                email,
                user_role,
                status
              )
            )
          )
        `)
        .order('convo_id', { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      console.log("Data from Supabase:", data);

      if (!data || data.length === 0) {
        console.log("No data found in conversation_history");
        return [];
      }

      const formattedData = data.map((conversation: any) => {
        // Define the date format options for consistency
        const dateFormatOptions: Intl.DateTimeFormatOptions = {
          timeZone: "Asia/Manila",
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hour12: true,
        };

        return {
          ...conversation,
          created_at: conversation.created_at
            ? new Date(conversation.created_at).toLocaleString("en-US", dateFormatOptions)
            : null,
          task_taken: {
            ...conversation.task_taken,
            created_at: conversation.task_taken.created_at
              ? new Date(conversation.task_taken.created_at).toLocaleString("en-US", dateFormatOptions)
              : null,
            task_created_at: conversation.task_taken.created_at
              ? new Date(conversation.task_taken.created_at).toLocaleString("en-US", dateFormatOptions)
              : null,
          },
        };
      });

      console.log("Formatted data:", formattedData);
      return formattedData;
    } catch (error) {
      console.error("Error in getUserConversation:", error);
      throw error;
    }
  }

  static async sendMessage(task_taken_id: number, user_id: string, conversation: string) {
            // Verify if task_taken_id exists
            const { data: taskExists, error: taskError } = await supabase
            .from("task_taken")
            .select("task_taken_id")
            .eq("task_taken_id", task_taken_id)
            .single()

        if (taskError || !taskExists) throw new Error("Task Taken ID does not exist or an error occurred while checking it.");

        const {data: messageData, error: conversationError} = await supabase.from("conversation_history").insert({
            task_taken_id, 
            user_id, 
            conversation,
            reported: false
        }).select("convo_id").single()

        if(conversationError) throw new Error("An error occurred while sending the message: " + conversationError.message)
        if(!messageData) throw new Error("An error occurred while sending the message: No data returned.")

        const { error: incrementError } = await supabase.rpc('increment_message_notifs', {
            p_task_taken_id: task_taken_id,
            p_message_id: messageData.convo_id,
          });

        if(incrementError) throw new Error("An error occurred while incrementing the message notifications: " + incrementError.message)
  }

  static async deleteConversation(task_taken_id: number) {
    const { error } = await supabase
        .from("task_taken")
        .update({is_deleted: true})
        .eq("task_taken_id", task_taken_id)
        .single();

    if (error) {
      console.error("Supabase delete error:", error);
      throw new Error("Failed to delete conversation");
    }

    return true;
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
   * Updates the task_taken on who currently visits.
   * @param task_taken_id 
   * @param user_id 
   * @param role 
   * @returns 
   */
  static async updateMessageNotification(task_taken_id: number, role: string) {
    console.log("Role: ", role)

    let updateData = {};
    if (role === "Client") {
      updateData = { visit_client: true, visit_tasker : false };
    } else if (role === "Tasker") {
      updateData = { visit_tasker: true, visit_client : false };
    } else {
      throw new Error("Invalid role provided. Must be either 'Client' or 'Tasker'.");
    }

    const { error } = await supabase
      .from("task_taken")
      .update(updateData)
      .eq("task_taken_id", task_taken_id);

    if (error) {
      throw new Error("Failed to update message notification. The Error is: " + error.message);
    }
  }
}

export default ConversationModel;