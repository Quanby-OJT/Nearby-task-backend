import { supabase } from "../config/configuration"
import { Request, Response } from "express"

class ConversationController {
    static async sendMessage(req: Request, res: Response): Promise<void> {
        const {task_taken_id, user_id, conversation} = req.body

        const {data, error} = await supabase.from("conversation_history").insert({
            task_taken_id, 
            user_id, 
            conversation,
            reported: false
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
        console.log("Retrieving Messages for User ID of: ", user_id)

        const {data, error} = await supabase.from("user").select("user_role").eq("user_id", user_id).single()
        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occurred while Retrieving Your Messages. Please Try Again"})
            return
        }
        const role = data.user_role
        // console.log(role)
        if(role === "Tasker"){
        const { data, error } = await supabase
            .from("task_taken")
            .select(`
                task_taken_id,
                post_task!task_id (
                    task_id,
                    task_title
                ),
                clients!client_id (
                    user!user_id (first_name, middle_name, last_name)
                ),
                tasker!tasker_id (
                    user!user_id (first_name, middle_name, last_name)
                )
            `)
            .eq("tasker_id", user_id);
                
            console.log(data, error)
    
            if(error){
                console.error(error.message)
                res.status(500).json({error: "An Error Occurred while Retrieving Your Messages. Please Try Again"})
                return
            }
            res.status(200).json({data: data})
        }else if(role === "Client"){
            const { data, error } = await supabase.from("task_taken").select(`
                task_taken_id,
                post_task!task_id (
                    task_id,
                    task_title
                ),
                clients!client_id (
                    user!user_id (first_name, middle_name, last_name)
                ),
                tasker!tasker_id (
                    user!user_id (first_name, middle_name, last_name)
                )
            `).eq("client_id", user_id);
                    
            console.log(data, error)
        
            if(error){
                console.error(error.message)
                res.status(500).json({error: "An Error Occurred while Retrieving Your Messages. Please Try Again"})
                return
            }
        
            res.status(200).json({data: data})
        }
    }

    static async getMessages(req: Request, res: Response): Promise<void> {
        const task_taken_id = req.params.task_taken_id
        console.log("Retrieving Messages for Task Taken ID of: ", task_taken_id)

        const {data, error} = await supabase.from("conversation_history").select("conversation, user_id").eq("task_taken_id", task_taken_id)
        if(error){
            console.error(error.message)
            res.status(500).json({error: "An Error Occurred while Retrieving Your Messages. Please Try Again"})
            return
        }

        res.status(200).json({data: data})
    }
}

export default ConversationController