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

    static async updateSpecialization(req: Request, res: Response): Promise<void> {
        const { user_id } = req.params;
        const { specialization } = req.body;
      
        console.log('User ID:', user_id);
        console.log('Specialization:', specialization);
      
        if (!specialization || !Array.isArray(specialization) || specialization.length === 0) {
          res.status(400).json({ error: 'Specialization must be a non-empty array' });
          return;
        }
      
        try {
          
      
          const { data: existingData, error: fetchError } = await supabase
            .from('user_preference')
            .select('*')
            .eq('user_id', user_id)
            .single();
      
          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Fetch error:', fetchError.message);
            res.status(500).json({ error: 'Failed to check user preferences' });
            return;
          }
      
          if (existingData) {
            const { data: updateData, error: updateError } = await supabase
              .from('user_preference')
              .update({ specialization: specialization, updated_at: new Date() })
              .eq('user_id', user_id)
              .select();
      
            if (updateError) {
              console.error('Update error:', updateError.message);
              res.status(500).json({ error: 'Failed to update specialization' });
              return;
            }
          } else {
            const { data: insertData, error: insertError } = await supabase
              .from('user_preference')
              .insert({ specialization: specialization, user_id })
              .select();
      
            if (insertError) {
              console.error('Insert error:', insertError.message);
              res.status(500).json({ error: 'Failed to insert specialization' });
              return;
            }
          }
      
          res.status(200).json({ message: 'Specialization updated successfully' });
        } catch (e) {
          console.error('Unexpected error:', e);
          res.status(500).json({ error: 'An unexpected error occurred' });
        }
      }

      static async updateDistance(req: Request, res: Response): Promise<void> {
        const { user_id } = req.params;
        const { Distance, Age_Start, Age_End, Show_further_away } = req.body;

        const distance = Math.ceil(Distance);
        const age_start = Math.ceil(Age_Start);
        const age_end = Math.ceil(Age_End);
        const limit = Boolean(Show_further_away);

        if (!distance || !age_start || !age_end || typeof limit !== 'boolean') {
          res.status(400).json({ error: 'Invalid input' });
          return;
        }

        try {
          const { data: existingData, error: fetchError } = await supabase
            .from('user_preference')
            .select('*')
            .eq('user_id', user_id)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Fetch error:', fetchError.message);
            res.status(500).json({ error: 'Failed to check user preferences' });
            return;
          }

          if (existingData) {
            const { data: updateData, error: updateError } = await supabase
              .from('user_preference')
              .update({ distance, age_start, age_end, limit, updated_at: new Date() })
              .eq('user_id', user_id)
              .select();

            if (updateError) {
              console.error('Update error:', updateError.message);
              res.status(500).json({ error: 'Failed to update distance' });
              return;
            }
          } else {
            const { data: insertData, error: insertError } = await supabase
              .from('user_preference')
              .insert({ user_id, distance, age_start, age_end, limit })
              .select();

            if (insertError) {
              console.error('Insert error:', insertError.message);
              res.status(500).json({ error: 'Failed to insert distance' });
              return;
            }
          }

          res.status(200).json({ message: 'Distance updated successfully' });
        } catch (e) {
          console.error('Unexpected error:', e);
          res.status(500).json({ error: 'An unexpected error occurred' });
        }
      }

      
}

export default SettingController;
