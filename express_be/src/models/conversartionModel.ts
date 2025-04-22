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
        .order('convo_id', { ascending: true });

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

  static async deleteConversation(task_taken_id: number) {
    const { data, error } = await supabase
        .from("task_taken")
        .delete()
        .eq("task_taken_id", task_taken_id)
        .single();

    if (error) {
      console.error("Supabase delete error:", error);
      throw new Error("Failed to delete conversation");
    }

    return data;
  }
}

export default ConversationModel;