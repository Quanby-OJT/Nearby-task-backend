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
                    *,
                    address (*),
                    tasker_specialization(*)
                ),
                clients!client_id (
                    user!user_id (
                        user_id,
                        first_name,
                        middle_name,
                        last_name,
                        image_link
                    ),
                    *
                ),
                tasker!tasker_id (
                    user!user_id (
                        user_id,
                        first_name,
                        middle_name,
                        last_name,
                        image_link
                    ),
                    *,
                    tasker_specialization(*)
                )
            `)
            .eq(user_role_id, user_id)
            .eq("is_deleted", false)
            .order("task_taken_id", { ascending: false });
    
        if (TaskTakenError) {
            console.error("Error while retrieving tasks" + TaskTakenError.message);
            res.status(500).json({ error: "An Error Occurred while Retrieving Your Messages. Please Try Again" });
            return;
        }
    
        if (!TaskTakenData || TaskTakenData.length === 0) {
            console.log("No Task Taken Data Found");
            res.status(200).json({ data: [[], []] });
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
                .order("convo_id", { ascending: false }) 
                .limit(1)
                .then(({ data, error }) => {
                    if (error) {
                        console.error(`Error fetching message for task_taken_id ${task.task_taken_id}:`, error.message);
                        return null;
                    }
                    if (!data || data.length === 0) {
                        return null;
                    }
                    return {
                        task_taken_id: task.task_taken_id,
                        user_id: data[0].user_id || null,
                        created_at: data[0].created_at || null,
                    };
                })
        );
    
        const latestMessages = await Promise.all(latestMessagesPromises);
    
        const conversationData = latestMessages
            .filter((msg) => msg !== null && msg.user_id !== null && msg.created_at !== null)
            .map((msg) => ({
                task_taken_id: msg?.task_taken_id,
                user_id: msg?.user_id,
                created_at: msg?.created_at,
            }));
    
        res.status(200).json({ task_taken: TaskTakenData, conversation: conversationData });
    }

    static async getMessages(req: Request, res: Response): Promise<void> {
        console.log('getMessages Request:', {
            method: req.method,
            url: req.url,
            params: req.params
        });
        const task_taken_id = req.params.task_taken_id

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

        // Format the created_at field to include date and time (e.g., "5/18/2025, 4:10 PM")
        const dateFormatOptions: Intl.DateTimeFormatOptions = {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "numeric",
            day: "numeric",
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
        try{
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
                .select("task_taken_id, conversation_history!conversation_history_task_taken_id_fkey(user_id)")
                .eq("task_taken_id", task_taken_id)
                .single()
    
            
    
            console.log(taskExists, taskError)
    
            if (taskError || !taskExists) {
                res.status(404).json({ error: "Task taken ID does not exist" })
                return
            }

            // Get the last user_id from conversation_history
            const lastUserId = taskExists?.conversation_history?.length != undefined
            ? taskExists?.conversation_history[taskExists.conversation_history.length - 1].user_id 
            : 0;
    
            console.log("Last user ID from conversation:", lastUserId);
    
            // If the lastUserId matches the user_id (meaning they're trying to read their own message), skip
            if(lastUserId === user_id){
                console.log("User ID does not match the last user ID in conversation history")
                res.status(200).json({message: ""})
                return
            }
    
            const {data, error} = await supabase.from("task_taken").update({
                unread_count: 0,
            }).eq("task_taken_id", task_taken_id).eq(user_role_id, user_id)
            
            console.log("Data: ", data, error)
            
            if(error) throw new Error(error.message)
            
            // Update the unread_count in the conversation_history table
            const { error: updateError } = await supabase
                .from("conversation_history")
                .update({ is_read: true })
                .eq("task_taken_id", task_taken_id)
                .eq("user_id", lastUserId) // Only mark messages from the sender as read
            
            if (updateError) throw new Error(updateError.message)
    
            console.log("successfully marked messages as read")
            res.status(200).json({message: "Your Messages have been Marked as Read Successfully."})
        }catch(error){
            console.error(error instanceof Error ? error.message : "Internal Server Error")
            res.status(500).json({error: "An Error Occurred while Marking Messages as Read. Please Try Again"})
        }
    }

    static async getUserConversation(req: Request, res: Response): Promise<void>{
        console.log('getUserConversation Request:', {
            method: req.method,
            url: req.url,
            query: req.query
        });
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

    static async appealUser(req: Request, res: Response): Promise<void> {
        console.log('appealUser Request:', {
            method: req.method,
            url: req.url,
            params: req.params,
            body: req.body
        });
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const { loggedInUserId, taskTakenId, reason } = req.body;
            if (!loggedInUserId || isNaN(loggedInUserId)) {
                res.status(400).json({ error: "Logged-in user ID is required and must be a valid number" });
                return;
            }
            if (!taskTakenId || isNaN(taskTakenId)) {
                res.status(400).json({ error: "Task taken ID is required and must be a valid number" });
                return;
            }
            if (!reason) {
                res.status(400).json({ error: "Reason for appealing is required" });
                return;
            }

            // Get the latest convo_id for this user and taskTakenId
            const { data: convoRow, error: convoIdError } = await supabase
                .from("conversation_history")
                .select("convo_id")
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (convoIdError || !convoRow) {
                res.status(400).json({ error: "Could not find conversation for this user and task." });
                return;
            }

            // Insert into action_taken_by with convo_id
            const { data: actionData, error: actionError } = await supabase
                .from("action_taken_by")
                .insert({
                    user_id: loggedInUserId,
                    action_reason: reason,
                    created_at: new Date().toISOString(),
                    convo_id: convoRow.convo_id
                })
                .select()
                .single();

            if (actionError) {
                console.error("Supabase insert error for action_taken_by:", actionError);
                res.status(500).json({
                    success: false,
                    message: `Failed to log action: ${actionError.message}`,
                });
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from("user")
                .update({ acc_status: "Active", action_by: loggedInUserId })
                .eq("user_id", userId)
                .select()
                .single();

            if (userError) {
                console.error("Supabase update error (user table):", userError);
                throw userError;
            }

            if (!userData) {
                console.log(`User with ID ${userId} not found`);
                res.status(404).json({ error: "User not found" });
                return;
            }

            const { data: convoData, error: convoError } = await supabase
                .from("conversation_history")
                .update({ action_by: loggedInUserId, reported: true  })
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId);

            if (convoError) {
                console.error("Supabase update error (conversation_history table):", convoError);
                throw convoError;
            }

            console.log(`User with ID ${userId} has been appealed by user ${loggedInUserId} for task_taken_id ${taskTakenId} with reason: ${reason}`);
            res.status(200).json({ message: "User has been appealed successfully" });
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }


    static async banUser(req: Request, res: Response): Promise<void> {
        console.log('banUser Request:', {
            method: req.method,
            url: req.url,
            params: req.params,
            body: req.body
        });
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const { loggedInUserId, taskTakenId, reason } = req.body;
            if (!loggedInUserId || isNaN(loggedInUserId)) {
                res.status(400).json({ error: "Logged-in user ID is required and must be a valid number" });
                return;
            }
            if (!taskTakenId || isNaN(taskTakenId)) {
                res.status(400).json({ error: "Task taken ID is required and must be a valid number" });
                return;
            }
            if (!reason) {
                res.status(400).json({ error: "Reason for banning is required" });
                return;
            }

            // Get the latest convo_id for this user and taskTakenId
            const { data: convoRow, error: convoIdError } = await supabase
                .from("conversation_history")
                .select("convo_id")
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (convoIdError || !convoRow) {
                res.status(400).json({ error: "Could not find conversation for this user and task." });
                return;
            }

            // Insert into action_taken_by with convo_id
            const { data: actionData, error: actionError } = await supabase
                .from("action_taken_by")
                .insert({
                    user_id: loggedInUserId,
                    action_reason: reason,
                    created_at: new Date().toISOString(),
                    convo_id: convoRow.convo_id
                })
                .select()
                .single();

            if (actionError) {
                console.error("Supabase insert error for action_taken_by:", actionError);
                res.status(500).json({
                    success: false,
                    message: `Failed to log action: ${actionError.message}`,
                });
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from("user")
                .update({ acc_status: "Banned", action_by: loggedInUserId })
                .eq("user_id", userId)
                .select()
                .single();

            if (userError) {
                console.error("Supabase update error (user table):", userError);
                throw userError;
            }

            if (!userData) {
                console.log(`User with ID ${userId} not found`);
                res.status(404).json({ error: "User not found" });
                return;
            }

            const { data: convoData, error: convoError } = await supabase
                .from("conversation_history")
                .update({ action_by: loggedInUserId, reported: true  })
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId);

            if (convoError) {
                console.error("Supabase update error (conversation_history table):", convoError);
                throw convoError;
            }

            console.log(`User with ID ${userId} has been banned by user ${loggedInUserId} for task_taken_id ${taskTakenId} with reason: ${reason}`);
            res.status(200).json({ message: "User has been banned successfully" });
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }


    static async warnUser(req: Request, res: Response): Promise<void> {
        console.log('warnUser Request:', 
            {
            method: req.method,
            url: req.url,
            params: req.params,
            body: req.body
            });
            
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const { loggedInUserId, taskTakenId, reason } = req.body;
            if (!loggedInUserId || isNaN(loggedInUserId)) {
                res.status(400).json({ error: "Logged-in user ID is required and must be a valid number" });
                return;
            }
            if (!taskTakenId || isNaN(taskTakenId)) {
                res.status(400).json({ error: "Task taken ID is required and must be a valid number" });
                return;
            }
            if (!reason) {
                res.status(400).json({ error: "Reason for warning is required" });
                return;
            }

            // Get the latest convo_id for this user and taskTakenId
            const { data: convoRow, error: convoIdError } = await supabase
                .from("conversation_history")
                .select("convo_id")
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (convoIdError || !convoRow) {
                res.status(400).json({ error: "Could not find conversation for this user and task." });
                return;
            }

            // Insert into action_taken_by with convo_id
            const { data: actionData, error: actionError } = await supabase
                .from("action_taken_by")
                .insert({
                    user_id: loggedInUserId,
                    action_reason: reason,
                    created_at: new Date().toISOString(),
                    convo_id: convoRow.convo_id
                })
                .select()
                .single();

            if (actionError) {
                console.error("Supabase insert error for action_taken_by:", actionError);
                res.status(500).json({
                    success: false,
                    message: `Failed to log action: ${actionError.message}`,
                });
                return;
            }

            const { data: userData, error: userError } = await supabase
                .from("user")
                .update({ acc_status: "Warn", action_by: loggedInUserId })
                .eq("user_id", userId)
                .select()
                .single();

            if (userError) {
                console.error("Supabase update error (user table):", userError);
                throw userError;
            }

            if (!userData) {
                console.log(`User with ID ${userId} not found`);
                res.status(404).json({ error: "User not found" });
                return;
            }

            const { data: convoData, error: convoError } = await supabase
                .from("conversation_history")
                .update({ action_by: loggedInUserId, reported: true })
                .eq("task_taken_id", taskTakenId)
                .eq("user_id", userId);

            if (convoError) {
                console.error("Supabase update error (conversation_history table):", convoError);
                throw convoError;
            }

            console.log(`User with ID ${userId} has been warned by user ${loggedInUserId} for task_taken_id ${taskTakenId} with reason: ${reason}`);
            res.status(200).json({ message: "User has been warned successfully" });
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