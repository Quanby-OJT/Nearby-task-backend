import { supabase } from "../config/configuration";

class TaskerModel {
  static async createTasker(tasker: {
    user_id: number;
    bio?: string;
    specialization_id?: number;
    skills?: string;
    availability?: boolean;
    wage_per_hour?: number;
    social_media_links?: object;
    pay_period?: string;
    rating?: number;
  }) {
    const { data, error } = await supabase.from("tasker").insert([{
      user_id: tasker.user_id,
      bio: tasker.bio || '',
      specialization_id: tasker.specialization_id || null,
      skills: tasker.skills || '',
      availability: tasker.availability || true,
      wage_per_hour: tasker.wage_per_hour || 0,
      social_media_links: tasker.social_media_links || {},
      pay_period: tasker.pay_period || 'Hourly',
      rating: tasker.rating || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);
    
    console.log(data, error);
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * The code is intended for the authenticated user.
   * @returns - {Promise<{id: number, bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}[]>}
   * @throws {Error}
   */
  static async getAuthenticatedTasker(user_id: number) {
    const { data, error } = await supabase
      .from("tasker")
      .select("*, user(*)")
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);
    return data;
  }

  static async getTaskerByUserId(user_id: number) {
    const { data, error } = await supabase
      .from("tasker")
      .select("*")
      .eq("user_id", user_id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  static async updateTasker(tasker: {
    user_id: number;
    bio?: string;
    skills?: string;
    availability?: boolean;
    wage_per_hour?: number;
    social_media_links?: object;
    specialization_id?: number;
    pay_period?: string;
    rating?: number;
  }) {
    const { data, error } = await supabase
      .from("tasker")
      .update({
        bio: tasker.bio,
        skills: tasker.skills,
        availability: tasker.availability,
        wage_per_hour: tasker.wage_per_hour,
        social_media_links: tasker.social_media_links,
        specialization_id: tasker.specialization_id,
        pay_period: tasker.pay_period,
        rating: tasker.rating,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", tasker.user_id)
      .select();
    
    console.log(data, error);
    if (error) throw new Error(error.message);
    return data;
  }

  // Submit tasker verification data
  static async submitTaskerVerification(verificationData: {
    user_id: number;
    bio?: string;
    social_media_links?: object;
    specialization_id?: number;
    skills?: string;
    wage_per_hour?: number;
    pay_period?: string;
    availability?: boolean;
  }) {
    try {
      // Check if tasker record exists
      const { data: existingTasker, error: checkError } = await supabase
        .from("tasker")
        .select("*")
        .eq("user_id", verificationData.user_id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(checkError.message);
      }

      const taskerData = {
        user_id: verificationData.user_id,
        bio: verificationData.bio || '',
        social_media_links: verificationData.social_media_links || {},
        specialization_id: verificationData.specialization_id || null,
        skills: verificationData.skills || '',
        wage_per_hour: verificationData.wage_per_hour || 0,
        pay_period: verificationData.pay_period || 'Hourly',
        availability: verificationData.availability !== false,
        updated_at: new Date().toISOString()
      };

      if (existingTasker) {
        // Update existing tasker
        const { data, error } = await supabase
          .from("tasker")
          .update(taskerData)
          .eq("user_id", verificationData.user_id)
          .select();
        
        if (error) throw new Error(error.message);
        return data;
      } else {
        // Create new tasker record
        const { data, error } = await supabase
          .from("tasker")
          .insert([{
            ...taskerData,
            rating: 0,
            created_at: new Date().toISOString()
          }])
          .select();
        
        if (error) throw new Error(error.message);
        return data;
      }
    } catch (error: any) {
      throw new Error(`Failed to submit tasker verification: ${error.message}`);
    }
  }

  /**
   * Update Tasker Information
   */
  static async update(
    tasker: {
      tasker_id: number;
      address: JSON;
      bio: Text;
      skills: string;
      availability: boolean;
      wage_per_hour: number;
      social_media_links: JSON; 
    },
    withForeignKeys: {
      specialization: string;
      tesda_documents_link: string;
    },
    user: {
      user_id: number;
      first_name: Text;
      middle_name: Text;
      last_name: Text;
      email: Text;
      password: Text;
    }
  ) {
    const { data: specializations, error: specializationError } = await supabase
      .from("tasker_specialization")
      .select("spec_id")
      .eq("specialization", withForeignKeys.specialization)
      .single();
    if (specializationError) throw new Error(specializationError.message);
  
    if(withForeignKeys.tesda_documents_link === null) {
    const { error: tesda_error } = await supabase
      .from("tasker_documents")
      .insert({ tesda_document_link: withForeignKeys.tesda_documents_link })
      .select("id")
      .single();
    if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);
    }else{
      const { error: tesda_error } = await supabase
      .from("tasker_documents")
      .update({ tesda_document_link: withForeignKeys.tesda_documents_link })
      .eq("tasker_id", tasker.tasker_id)
      if (tesda_error) throw new Error("Error storing document reference: " + tesda_error.message);
    }

    const { data: userData, error: userError } = await supabase
      .from("user")
      .update(user)
      .eq("user_id", user.user_id);
    if (userError) throw new Error(userError.message);
  
    const { data: taskerData, error: taskerError } = await supabase
      .from("tasker")
      .update({
        address: tasker.address,
        bio: tasker.bio,
        skills: tasker.skills,
        availability: tasker.availability,
        wage_per_hour: tasker.wage_per_hour,
        social_media_links: tasker.social_media_links,
        specialization_id: specializations.spec_id,
      })
      .eq("user_id", user.user_id);
    console.log(taskerData, taskerError);
    if (taskerError) throw new Error(taskerError.message + "\n\n" + taskerError.stack);
  
    return { userData, taskerData };
  }
}

export default TaskerModel;
