import {supabase} from "../config/configuration"

class FeedbackModel{
    async createNewFeedback(
        task_taken_id: number,
        feedback: string,
        rating: number,
        tasker_id: number,
    ) {
        console.log(
            "Creating feedback with data:",
            task_taken_id,
            feedback,
            rating,
            tasker_id,
        )

        const { data: feedbackData, error: feedbackError } = await supabase
            .from("task_reviews")
            .insert([
                {
                    task_taken_id: task_taken_id,
                    feedback: feedback,
                    rating: rating,
                    tasker_id: tasker_id,
                }
            ])
            .select("rating")
            .single()
        
        const { data: taskerData, error: taskerError } = await supabase.rpc("update_tasker_rating", {
            _tasker_id: tasker_id, _rating: feedbackData?.rating
        })

        if (feedbackError || taskerError) {
            console.error("Error creating feedback:", feedbackError || taskerError)
            throw new Error(feedbackError?.message || taskerError?.message)
        }

        console.log("Feedback created successfully!")
    }

    async getTaskerFeedback(taskerId: number) {
        console.log("Fetching feedback for tasker:", taskerId)

        const { data, error } = await supabase
            .from("task_reviews")
            .select("rating, feedback")
            .eq("tasker_id", taskerId)

        if (error) {
            console.error("Error fetching tasker feedback:", error)
            throw new Error(error.message)
        }

        return data
    }
}

export default new FeedbackModel()