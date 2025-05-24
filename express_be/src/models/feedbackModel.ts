import { supabase } from "../config/configuration";

class FeedbackModel {
  static async createFeedback(feedbackInfo: {
    task_taken_id: number;
    tasker_id: number;
    feedback: string;
    rating: number;
  }) {
    const { data: existingReview, error: existingError } = await supabase
      .from("task_reviews")
      .select(`
        task_taken_id,
        tasker_id
      `)
      .eq("task_taken_id", feedbackInfo.task_taken_id)
      .eq("tasker_id", feedbackInfo.tasker_id);

    if (existingError) throw new Error(existingError.message);
    if (existingReview && existingReview.length > 0) {
      return { error: "Feedback already exists for this task" };
    }

    const { data: taskReviewData, error: taskReviewError } = await supabase
      .from("task_reviews")
      .insert([feedbackInfo]);

    if (taskReviewError) throw new Error(taskReviewError.message);
  }

  static async getFeedback(tasker_id: number) {
    interface TaskReviews {
      task_taken: {
        clients: {
          user: {
            first_name: string;
            middle_name: string;
            last_name: string;
          };
        };
        post_task: {
          task_title: string;
        };
      };
      rating: number;
      feedback: string;
    }

    const { data: taskReviewData, error: taskReviewError } = await supabase
      .from("task_reviews")
      .select(`
        task_taken(
          clients(
            user(
              first_name,
              middle_name,
              last_name
            )
          ),
          post_task(task_title)
        ),
        rating,
        feedback
      `)
      .eq("tasker_id", tasker_id) as { data: TaskReviews | null; error: Error };

    console.log(taskReviewData, taskReviewError);

    if (taskReviewError) throw new Error(taskReviewError.message);

    return taskReviewData;
  }

    static async getFeedbackForClient(task_taken_id: number) {

    const { data: taskReviewData, error: taskReviewError } = await supabase
      .from("task_reviews")
      .select(`
        rating,
        feedback
      `)
      .eq("task_taken_id", task_taken_id).single();

    if (taskReviewError) throw new Error(taskReviewError.message);

    return taskReviewData;
  }

  static async getTaskerFeedback() {
    const { data, error } = await supabase.from("task_reviews")
      .select(`
        created_at,
        feedback,
        rating,
        reported,
        task_taken_id,
        tasker:tasker_id (
          tasker_id,
          user:user_id (
            first_name,
            middle_name,
            last_name
          )
        ),
        task_taken:task_taken_id (
          client:client_id (
            user:user_id (
              first_name,
              middle_name,
              last_name
            )
          )
        )
      `)
      .order('review_id', { ascending: false });;

    if (error) {
      throw error;
    }

    return data.map((feedback: any) => ({
      ...feedback,
      created_at: feedback.created_at
        ? new Date(feedback.created_at).toLocaleString("en-US", {
            timeZone: "Asia/Manila",
          })
        : null,
    }));
  }
}

export default FeedbackModel;