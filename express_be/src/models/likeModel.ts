import { supabase } from "../config/configuration";


class Like {
  /**
   * This section can only be accessed by the Admin Only, all users can only create and edit their user information.
   * @param likeData 
   * @returns 
   */
  async create(likeData: { user_id: number; job_post_id: number; created_at: string; }) {
    console.log("Creating like with data:", likeData); // Add logging

    const { data, error } = await supabase
      .from("likes") // Dapat tama ang table name mo sa database
      .insert([likeData]);

    if (error) {
      console.error("Error creating like:", error.message); // Add logging
      throw new Error(error.message);
    }

    console.log("You like this job!", data); // Add logging
    return data;
  }
}

const likeModel = new Like();
export default likeModel;