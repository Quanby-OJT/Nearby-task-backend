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

    static async getFeedback(tasker_id: number) {
        const { data: taskReviewData, error: taskReviewError } = await supabase
            .from("task_reviews")
            .select(``)
            .eq("task_taken_id", tasker_id)
            .single();

        if (taskReviewError) throw new Error(taskReviewError.message);

        return taskReviewData;
    }
}

export default FeedbackModel;