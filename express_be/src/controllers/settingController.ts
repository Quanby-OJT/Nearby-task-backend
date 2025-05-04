import { supabase } from "../config/configuration";
import { Request, Response } from "express";

class SettingController {
    static async setLocation(req: Request, res: Response): Promise<void> {
        const { latitude, longitude } = req.body;
        const { user_id } = req.params;

        console.log(user_id);
        console.log(latitude);
        console.log(longitude);
    
        if (!latitude || !longitude) {
            res.status(400).json({ error: "latitude and longitude are required" });
            return;
        }
    
        try {

            const { data: existingData, error: fetchError } = await supabase
            .from("user_preference")
            .select("*")
            .eq("user_id", user_id)
            .single();

            if (fetchError && fetchError.code !== 'PGRST116') { 
                console.error(fetchError.message);
                res.status(500).json({ error: "An Error Occurred while Checking Location" });
                return;
            }

            if (existingData) {

                const { data: updateData, error: updateError } = await supabase
                    .from("user_preference")
                    .update({ latitude, longitude, updated_at: new Date() })
                    .eq("user_id", user_id)
                    .select();

            if (updateError) {
                    console.error(updateError.message);
                    res.status(500).json({ error: "An Error Occurred while Updating Location" });
                    return;
            }

            } else {
                const { data: insertData, error: insertError } = await supabase
                    .from("user_preference")
                    .insert({ latitude, longitude, user_id })
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
        const { user_id } = req.params;
    
        try {
            const { data, error } = await supabase
                .from("user_preference")
                .select("*")
                .eq("user_id", user_id);
    
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
