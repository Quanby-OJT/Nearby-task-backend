import { supabase } from "../config/configuration";
import { Request, Response } from "express";

class SettingController {
    static async setLocation(req: Request, res: Response): Promise<void> {
        const { latitude, longitude } = req.body;
        const { tasker_id } = req.params;

        console.log(tasker_id);
        console.log(latitude);
        console.log(longitude);
    
        if (!latitude || !longitude) {
            res.status(400).json({ error: "latitude and longitude are required" });
            return;
        }
    
        try {

            const { data: existingData, error: fetchError } = await supabase
            .from("tasker_preference")
            .select("*")
            .eq("tasker_id", tasker_id)
            .single();

            if (fetchError && fetchError.code !== 'PGRST116') { 
                console.error(fetchError.message);
                res.status(500).json({ error: "An Error Occurred while Checking Location" });
                return;
            }

            if (existingData) {

                const { data: updateData, error: updateError } = await supabase
                    .from("tasker_preference")
                    .update({ latitude, longitude, updated_at: new Date() })
                    .eq("tasker_id", tasker_id)
                    .select();

            if (updateError) {
                    console.error(updateError.message);
                    res.status(500).json({ error: "An Error Occurred while Updating Location" });
                    return;
            }

            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from("tasker_preference")
                    .insert({ latitude, longitude, tasker_id })
                    .select();

            if (insertError) {
                console.error(insertError.message);
                res.status(500).json({ error: "An Error Occurred while Inserting Location" });
                return;
            }
        }

            res.status(200).json({ message: "Location has been Set Successfully." });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "An Error Occurred while Setting the Location" });
        }
    }

    static async getLocation(req: Request, res: Response): Promise<void> {
        const { tasker_id } = req.params;
    
        try {
            const { data, error } = await supabase
                .from("tasker_preference")
                .select("*")
                .eq("tasker_id", tasker_id);
    
            if (error) {
                console.error(error);
                res.status(500).json({ error: "An Error Occurred while Getting the Location" });
                return;
            }
            console.log(data);
    
            res.status(200).json({ message: "Location has been retrieved successfully", data });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "An Error Occurred while Getting the Location" });
        }
    }
}

export default SettingController;
