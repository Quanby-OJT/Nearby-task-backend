import { supabase } from "../config/configuration"
import { Request, Response } from "express"

class ConversationController {
    static async sendMessage(req: Request, res: Response): Promise<void> {
        const {task_taken_id, user_id, conversation} = req.body

        const {data, error} = await supabase.from("conversation_history").insert({
            task_taken_id, user_id, conversation
        })

        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occured while Sending a New Message"})
            return
        }

        res.status(200).json({message: "Your Message has been Sent Successfully.", data: data})
    }

    static async getAllMessages(req: Request, res: Response): Promise<void> {
        const user_id = req.params.user_id

        /**
         * Etong mga susunod na lines of code is kukunin siya from 2 tables using relationships: conversation_history and tasks_taken.
         * 
         * -Ces
         */
        const { data, error } = await supabase.from("task_taken").select("tasks!task_id (title), clients!client_id (users!user_id (first_name, middle_name, last_name), tasker!tasker_id (users!user_id (first_name, middle_name, last_name)").eq("user_id", user_id);
        console.log(data, error)

        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occured while Sending a New Message"})
            return
        }

        res.status(200).json({data: data})
    }
}

export default ConversationController