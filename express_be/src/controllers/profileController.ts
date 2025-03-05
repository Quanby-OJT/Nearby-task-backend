import { Request, Response } from "express";
import TaskerModel from "../models/taskerModel";
import ClientModel from "../models/clientModel";

class TaskerController{
    static async createTasker(req: Request, res: Response): Promise<any>{
        try{
            const {user_id, bio, specialization, skills, availability, wage_per_hour, tesda_documents_link, social_media_links} = req.body;

            await TaskerModel.createTasker({user_id, bio, specialization, skills, availability, wage_per_hour, tesda_documents_link, social_media_links});

            res.status(200).json({message: "Successfully created new profile."});
        } catch(error){
            res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
        }
    }
}

class ClientController{
    static async createClient(req: Request, res: Response): Promise<any>{
        try{
            const {user_id, preferences, client_address} = req.body;

            await ClientModel.createNewClient({user_id, preferences, client_address});

            res.status(201).json({message: "Successfully created new profile."});
        }catch(error){
            res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
        }
    }
}

export default {TaskerController, ClientController}