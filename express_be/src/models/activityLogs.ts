import { supabase } from "../config/configuration";

class ActivityLogging{
    constructor(
        public id: number,
        public userId: number,
        public activityType: string,
        public activityDescription: string,
        public timestamp: Date
    ) {}

    static async logActivity(userId: number, activityType: string, activityDescription: string) {
        const timestamp = new Date().toISOString(); // Converts timestamp to a proper string

        const { data, error } = await supabase.from("activity_logs").insert({
            user_id: userId,
            activity: activityType,
            description: activityDescription,
            date_of_activity: timestamp
        });

        if (error) throw new Error(error.message);
        return data;
    }
}

export default ActivityLogging;