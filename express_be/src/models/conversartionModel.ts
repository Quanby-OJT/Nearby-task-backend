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
            status
          ),
          task_taken_id,
          task_taken!task_taken_id (
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

      const formattedData = data.map((conversation: any) => ({
        ...conversation,
        created_at: conversation.created_at ? new Date(conversation.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null
      }));

      console.log("Formatted data:", formattedData);
      return formattedData;
    } catch (error) {
      console.error("Error in getUserConversation:", error);
      throw error;
    }
  }
}

export default ConversationModel;