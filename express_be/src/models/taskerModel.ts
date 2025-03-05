import {supabase} from "../config/configuration"

class TaskerModel{
    /**
     * 
     * @param tasker - {bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}
     * @returns 
     */
    static async createTasker(tasker : {
        user_id: number,
        bio: Text,
        specialization: Text,
        skills: Text,
        availability: boolean,
        wage_per_hour: number,
        tesda_documents_link: Text,
        social_media_links: Text,
    }){
        const {data, error} = await supabase.from('tasker').insert([tasker]);
        if(error) throw new Error(error.message)
        return data
    }

    /**
     * The code is intended for the authenticated user.
     * @returns - {Promise<{id: number, bio: Text, specialization: Text, skills: Text, availability: boolean, wage_per_hour: number, tesda_documents_link: Text, social_media_links: Text}[]>}
     * @throws {Error}
     */
    static async getAuthenticatedTasker(user_id: number){
        const {data, error} = await supabase.from('tasker').select('*').eq('user_id', user_id);
        if(error) throw new Error(error.message)
        return data
    }
}

export default TaskerModel