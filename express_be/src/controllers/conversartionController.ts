import { supabase } from "../config/configuration"
import ConversationModel from "../models/conversartionModel"
import { Request, Response } from "express"
import ClientTaskerModeration  from "../models/moderationModel"

class ConversationController {
    static async sendMessage(req: Request, res: Response): Promise<void> {
        try{
            const {task_taken_id, user_id, role, conversation} = req.body
            console.log(req.body)
    
            console.log("Sending Message for Task Taken ID of: ", task_taken_id)
    
            await ConversationModel.sendMessage(task_taken_id, user_id, conversation)
    
            await ConversationModel.updateMessageNotification(task_taken_id, role)
    
            res.status(200).json({message: "Your Message has been Sent Successfully."})
        }catch(error){
            console.error(error instanceof Error ? error.message : "Internal Server Error")
            res.status(500).json({error: "An Error Occurred while Sending Your Message. Please Try Again"})
        }
    }

    static async getAllMessages(req: Request, res: Response): Promise<void> {
        const user_id = req.params.user_id;
      
        // Retrieve user role
        const { data, error } = await supabase
          .from("user")
          .select("user_role")
          .eq("user_id", user_id)
          .single();
      
        if (error) {
          console.error(error.message);
          res.status(500).json({ error: "An Error Occurred while Retrieving Your Messages. Please Try Again" });
          return;
        }
      
        const role = data.user_role;
        let user_role_id = "";
      
        if (role === "Tasker") user_role_id = "tasker_id";
        else if (role === "Client") user_role_id = "client_id";
        else {
          res.status(400).json({ error: "Invalid User Role" });
          return;
        }
      
        console.log("User Role ID: ", user_role_id);
      
        // Retrieve task taken data
        const { data: TaskTakenData, error: TaskTakenError } = await supabase
          .from("task_taken")
          .select(`
            task_taken_id,
            task_status::text,
            unread_count,
            post_task!task_id (
              task_id,
              task_title
            ),
            tasker_id,
            client_id,
            clients!client_id (
              user!user_id (
                user_id,
                first_name,
                middle_name,
                last_name,
                image_link
              )
            ),
            tasker!tasker_id (
              user!user_id (
                user_id,
                first_name,
                middle_name,
                last_name,
                image_link
              )
            )
          `)
          .eq(user_role_id, user_id)
          .eq("is_deleted", false)
          .order("task_taken_id", { ascending: false });
      
        if (TaskTakenError) {
          console.error(TaskTakenError.message);
          res.status(500).json({ error: "An Error Occurred while Retrieving Your Messages. Please Try Again" });
          return;
        }
      
        if (!TaskTakenData || TaskTakenData.length === 0) {
          console.log("No Task Taken Data Found");
          res.status(200).json({ data: [[], []] }); // Return empty task and conversation lists
          return;
        }
      
        console.log("Task Taken IDs: ", TaskTakenData.map((item: any) => item.task_taken_id));
      
        // Fetch latest message for each task_taken_id
        const latestMessagesPromises = TaskTakenData.map((task: any) =>
          supabase
            .from("conversation_history")
            .select(`
              user_id,
              created_at
            `)
            .eq("task_taken_id", task.task_taken_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()
            .then(({ data, error }) => {
              if (error) {
                console.error(`Error fetching message for task_taken_id ${task.task_taken_id}:`, error.message);
                return null; // Return null for failed queries
              }
              return {
                task_taken_id: task.task_taken_id,
                user_id: data?.user_id || null,
                created_at: data?.created_at || null,
              };
            })
        );
      
        const latestMessages = await Promise.all(latestMessagesPromises);
      
        // Filter out null messages and format conversation data
        const conversationData = latestMessages
          .filter((msg) => msg !== null && msg.user_id !== null && msg.created_at !== null)
          .map((msg) => ({
            task_taken_id: msg?.task_taken_id,
            user_id: msg?.user_id,
            created_at: msg?.created_at,
          }));
      
        // Return task and conversation data as separate sublists
        res.status(200).json({ data: [TaskTakenData, conversationData] });
      }

    static async getMessages(req: Request, res: Response): Promise<void> {
        const task_taken_id = req.params.task_taken_id
        //console.log("Retrieving Messages for Task Taken ID of: ", task_taken_id)

        const {data, error} = await supabase
            .from("conversation_history")
            .select(`
                conversation,
                user_id,
                created_at,
                user:user!conversation_history_user_id_fkey (
                    first_name,
                    middle_name,
                    last_name,
                    image_link
                )
            `)
            .eq("task_taken_id", task_taken_id)
            .order('created_at', { ascending: true });

        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occurred while Retrieving Your Messages. Please Try Again"})
            return
        }

        // Format the created_at field to "hour:minute am/pm" (e.g., "2:53pm")
        const dateFormatOptions: Intl.DateTimeFormatOptions = {
            timeZone: "Asia/Manila",
            hour: "numeric",
            minute: "numeric",
            hour12: true,
        };

        const formattedData = data.map((item: any) => ({
            ...item,
            created_at: new Date(item.created_at).toLocaleString("en-US", dateFormatOptions).toLowerCase(),
        }));

        res.status(200).json({data: formattedData})
    }

    static async markMessagesAsRead(req: Request, res: Response): Promise<void> {
        const { task_taken_id, user_id, role } = req.body
        console.log("Marking Messages as Read for Task Taken ID of: ", task_taken_id, "and User ID of: ", user_id, "and Role of: ", role)

        let user_role_id = ""

        if(role == "Tasker") user_role_id = "tasker_id"
        else if(role == "Client") user_role_id = "client_id"
        else {
            res.status(400).json({error: "Invalid User Role"})
            return
        }

        // Verify if task_taken_id exists
        const { data: taskExists, error: taskError } = await supabase
            .from("task_taken")
            .select("task_taken_id")
            .eq("task_taken_id", task_taken_id)
            .single()

        if (taskError || !taskExists) {
            res.status(404).json({ error: "Task taken ID does not exist" })
            return
        }

        const {data, error} = await supabase.from("task_taken").update({
            unread_count: 0,
            last_message_id: null
        }).eq("task_taken_id", task_taken_id).eq(user_role_id, user_id)

        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occurred while Marking Messages as Read"})
            return
        }

        // Update the unread_count in the conversation_history table
        const { error: updateError } = await supabase
            .from("conversation_history")
            .update({ is_read: true })
            .eq("task_taken_id", task_taken_id)
            .eq("user_id", user_id)

        if (updateError) {
            console.error(updateError.message)
            res.status(500).json({ error: "An Error Occurred while Updating Unread Count" })
            return
        }

        console.log("successfully marked messages as read")
        res.status(200).json({message: "Your Messages have been Marked as Read Successfully.", data: data})
    }

    static async getUserConversation(req: Request, res: Response): Promise<void>{
        try {
            const conversation = await ConversationModel.getUserConversation();
            console.log("The Record Fetch From Conversation History Are:", conversation);            
            if(!conversation || conversation.length === 0){
                console.log("No conversations found");
                res.status(404).json({error: "No conversations found"});
                return;
            }
            res.status(200).json({data: conversation});
        }
        catch (error){
            if (error instanceof Error){
                res.status(500).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: "Unknown Error Occured" });
            }
        }
    }

    static async banUser(req: Request, res: Response): Promise<void> {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const result = await ConversationModel.banUser(userId);
            if (result) {
                res.status(200).json({ message: "User has been banned successfully" });
            } else {
                res.status(404).json({ error: "User not found" });
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }

    static async warnUser(req: Request, res: Response): Promise<void> {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const result = await ConversationModel.warnUser(userId);
            if (result) {
                res.status(200).json({ message: "User has been warned successfully" });
            } else {
                res.status(404).json({ error: "User not found" });
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }

    static async deleteConversation(req: Request, res: Response): Promise<void> {
        try {
            const task_taken_id = parseInt(req.params.messageId);
            if (isNaN(task_taken_id)) {
                res.status(400).json({ error: "Invalid task taken ID" });
                return;
            }

            const result = await ConversationModel.deleteConversation(task_taken_id);
            if (result) {
                res.status(200).json({ message: "Conversation deleted successfully" });
            } else {
                res.status(404).json({ error: "Conversation not found" });
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }
}

export default ConversationController;