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
        interface TaskReviews {
            task_taken: {
                clients: {
                    user: {
                        first_name: String;
                        middle_name: String;
                        last_name: String;
                    }
                },
                post_task: {
                    task_title: String
                }
            },
            rating: Number;
            feedback: String;
        }

        const { data: taskReviewData, error: taskReviewError } = await supabase
            .from("task_reviews")
            .select(`
                task_taken(
                    clients(
                        user(
                            first_name,
                            middle_name,
                            last_name,
                        )
                    ),
                    post_task('
                        task_title
                    )
                ),
                rating,
                feedback
            `)
            .eq("tasker_id", tasker_id) as { data: TaskReviews | null, error: Error}

        console.log(taskReviewData, taskReviewError);

        if (taskReviewError) throw new Error(taskReviewError.message);

        return taskReviewData;
    }
}

export default FeedbackModel;