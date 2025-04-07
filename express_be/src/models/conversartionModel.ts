import { supabase } from "../config/configuration";

class ConversationModel {
  static async getUserConversation() {
    try {
      console.log("Attempting to fetch conversation data...");
      const { data, error } = await supabase
        .from("conversation_history")
        .select(`
          *,
          user!user_id (
            first_name,
            middle_name,
            last_name,
            email,
            user_role
          )
        `)
        .order('convo_id', { ascending: true });

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      console.log("Raw data from Supabase:", data);

      if (!data || data.length === 0) {
        console.log("No data found in conversation_history");
        return [];
      }

      const formattedData = data.map((conversation: any) => ({
        ...conversation,
        logged_in: conversation.logged_in ? new Date(conversation.logged_in).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
        logged_out: conversation.logged_out ? new Date(conversation.logged_out).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
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