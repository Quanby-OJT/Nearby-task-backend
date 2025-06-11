import { supabase } from "../config/configuration";
import { Request, Response } from "express";

class SettingController {
  static async setLocation(req: Request, res: Response): Promise<void> {
    const { latitude, longitude, city, province } = req.body;
    const { user_id } = req.params;

    if (!user_id) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    if (!latitude || !longitude) {
        res.status(400).json({ error: "latitude and longitude are required" });
        return;
    }

    try {

        const { data: existingData, error: fetchError } = await supabase
        .from("address")
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
                .from("address")
                .update({ latitude, longitude, city, province, updated_at: new Date() })
                .eq("user_id", user_id)
                .select();

        if (updateError) {
                console.error(updateError.message);
                res.status(500).json({ error: "An Error Occurred while Updating Location" });
                return;
        }

        } else {
            const { data: insertData, error: insertError } = await supabase
                .from("address")
                .insert({ latitude, longitude, city, province, default: true, user_id })
                .select();

        if (insertError) {
            console.error(insertError.message);
            res.status(500).json({ error: "An Error Occurred while Inserting Location" });
            return;
        }
    }

    const {data: userAddressDefault, error: userAddressDefaultError} = await supabase
    .from("address")
    .select("*")
    .eq("user_id", user_id).eq("default", true)
    .single();

    if (userAddressDefaultError) {
        console.error(userAddressDefaultError.message);
        res.status(500).json({ error: "An Error Occurred while Setting Default Address" });
        return;
    }

    if (userAddressDefault) {

      const { data: existingData, error: fetchError } = await supabase
        .from("user_preference")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error(fetchError.message);
        res.status(500).json({ error: "An Error Occurred while Checking User Preferences" });
        return;
      }

      if (existingData) {
        const { data: updateDefaultAddress, error: updateDefaultAddressError } = await supabase
            .from("user_preference")
            .update({ user_address: userAddressDefault.id })
            .eq("user_id", user_id)
            .select();

        if (updateDefaultAddressError) {
            console.error(updateDefaultAddressError.message);
            res.status(500).json({ error: "An Error Occurred while Updating Default Address" });
            return;
        }
      } else {
        const { data: insertData, error: insertError } = await supabase
            .from("user_preference")
            .insert({ user_address: userAddressDefault.id,latitude, longitude, user_id })
          .select();

      if (insertError) {
        console.error(insertError.message);
        res.status(500).json({ error: "An Error Occurred while Inserting Location" });
        return;
      }
    }
  }

    res.status(200).json({ message: "Location has been Set Successfully." });
} catch (e) {
    console.error(e);
    res.status(500).json({ error: "An Error Occurred while Setting the Location" });
}
}

static async deleteAddress(req: Request, res: Response): Promise<any> {
  const { address_id } = req.params;

  if (!address_id) {
    res.status(400).json({ status: false, error: "Address ID is required" });
    return;
  }

  console.log("Address ID to be deleted: ", address_id);

  try {

    const { data: addressUsed, error: addressUsedError } = await supabase
    .from('post_task')
    .select('task_id')
    .eq('address', address_id)
    .limit(1);

    console.log("This is the task id: ", addressUsed);
    

  if (addressUsedError) {
    console.error('Error checking address usage:', addressUsedError.message);
    res.status(500).json({ status: false, error: 'Failed to check address usage' });
    return;
  }

  if (addressUsed.length > 0) {
    res.status(400).json({ status: false, message: 'Address is used in a task' });
    console.log("Address is used in a task");
    return;
  } else {
    console.log("Address is not used in a task"); 
    const { data: existingData, error: fetchError } = await supabase
      .from("address")
      .delete()
      .eq("id", address_id)
      .select();

    if (fetchError) {
      console.error(fetchError.message);
      res.status(500).json({ error: "An Error Occurred while Deleting the Address" });
      return;
    }

    if(!existingData) {
     res.status(400).json({ status: false, error: 'Address not found' });
     return;
    }

    res.status(200).json({ status: true, message: "Address has been deleted successfully" });
  }

    
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: false, error: "An Error Occurred while Deleting the Address" });
  }
}

static async setAddress(req: Request, res: Response): Promise<void> {
  const {
    latitude,
    longitude,
    formatted_Address,
    region,
    province,
    city,
    barangay,
    street,
    postal_code,
    country,
    remarks,
  } = req.body;
  const { user_id } = req.params;

  console.log({
    user_id,
    latitude,
    longitude,
    formatted_Address,
    region,
    province,
    city,
    barangay,
    street,
    postal_code,
    country,
    remarks,
  });

  if (!latitude || !longitude || !city || !province) {
    res.status(400).json({ error: "latitude, longitude, city, and province are required" });
    return;
  }

  try {
  
    // Prepare address data
    const addressData = {
      latitude,
      longitude,
      country,
      province,
      barangay,
      city,
      postal_code,
      street,
      formatted_Address,
      region,
      remarks,
    };

    const {error: insertError } = await supabase
        .from("address")
        .insert({ ...addressData,default:false, user_id })
        .select();

      if (insertError) {
        console.error("Insert error:", insertError.message);
        res.status(500).json({ error: "An error occurred while inserting address" });
        return;
      }
  
    res.status(200).json({ message: "Address has been set successfully" });
  } catch (e) {
    console.error("Unexpected error:", e);
    res.status(500).json({ error: "An unexpected error occurred while setting the address" });
  }
}

static async getLocation(req: Request, res: Response): Promise<void> {
  const { user_id } = req.params;

  try {
    const { data: preference, error: preferenceError } = await supabase
      .from("user_preference")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (preferenceError) {
      console.error("Supabase preference error:", preferenceError);
      res.status(500).json({ error: "Failed to retrieve user preferences" });
      return;
    }

    if (!preference) {
      res.status(404).json({ error: "User preferences not found" });
      return;
    }

    const { data: address, error: addressError } = await supabase
      .from("address")
      .select("*")
      .eq("user_id", user_id)
      .eq("default", true)
      .single();

    if (addressError) {
      console.error("Supabase address error:", addressError);
      res.status(500).json({ error: "Failed to retrieve default address" });
      return;
    }

    if (!address) {
      res.status(404).json({ error: "No default address found for user" });
      return;
    }

  console.log(address, preference);

    res.status(200).json({
      message: "Location retrieved successfully",
      data: {
        ...preference,
        address,
      },
    });
    
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

      static async getAddresses(req: Request, res: Response): Promise<void> {
        const { user_id } = req.params;
      
        try {
          
          const { data: address, error: addressError } = await supabase
            .from("address")
            .select("*")
            .neq("default", true)
            .eq("user_id", user_id)
      
          if (addressError) {
            console.error("Supabase address error:", addressError);
            res.status(500).json({ error: "Failed to retrieve default address" });
            return;
          }
      
          if (!address) {
            res.status(404).json({ error: "No default address found for user" });
            return;
          }
      
        console.log(address);
      
          res.status(200).json({
            message: "Location retrieved successfully",
            data: {
              address,
            },
          });
          
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "An Error Occurred while Getting the Location" });
        }
      
      }

      static async getAddress(req: Request, res: Response): Promise<void> {
        const { user_id } = req.params;
      
        try {
          const { data: preference, error: preferenceError } = await supabase
            .from("user_preference")
            .select("*")
            .eq("user_id", user_id)
            .maybeSingle();
      
          if (preferenceError) {
            console.error("Supabase preference error:", preferenceError);
            res.status(500).json({ error: "Failed to retrieve user preferences" });
            return;
          }
      
          if (!preference) {
            res.status(404).json({ error: "User preferences not found" });
            return;
          }
      
          const { data: address, error: addressError } = await supabase
            .from("address")
            .select("*")
            .eq("user_id", user_id)
            .maybeSingle();
      
          if (addressError) {
            console.error("Supabase address error:", addressError);
            res.status(500).json({ error: "Failed to retrieve default address" });
            return;
          }
      
          if (!address) {
            res.status(404).json({ error: "No default address found for user" });
            return;
          }
      
        console.log(address, preference);
      
          res.status(200).json({
            message: "Location retrieved successfully",
            data: {
              ...preference,
              address,
            },
          });
          
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "An Error Occurred while Getting the Location" });
        }
      
      }

      
}

export default SettingController;
