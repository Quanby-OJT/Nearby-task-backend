import { supabase } from "../config/configuration";

class FeedbackModel{
    static async createFeedback(feedbackInfo: {
        task_taken_id: number;
        tasker_id: number;
        feedback: string;
        rating: number;
    }) {
        const { data: taskReviewData, error: taskReviewError } = await supabase.from("task_reviews").insert([feedbackInfo])

        if (taskReviewError) throw new Error(taskReviewError.message);
    }
}

export default FeedbackModel;