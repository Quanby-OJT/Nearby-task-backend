import { Request, Response } from "express";
import FeedbackModel from "../models/feedbackModel";

class FeedbackController {
  /**
   * Rate the tasker by client
   * @param req
   * @param res
   * @return
   * @throws
   */
  static async postClientFeedbacktoTasker(req: Request, res: Response): Promise<void> {
    try {
      const { tasker_id, task_taken_id, rating, feedback } = req.body;
      console.log(req.body)

      await FeedbackModel.createFeedback({
        tasker_id: tasker_id,
        task_taken_id: task_taken_id,
        feedback,
        rating: parseInt(rating),
      });
      
      res.status(200).json({ message: "Feedback posted successfully"});
    } catch (error) {
      console.error("Error in postClientFeedbacktoTasker:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "An Error Occurred while Posting Feedback" });
    }
  }

  static async getFeedbackForTasker(req: Request, res: Response): Promise<void> {
    try{
        const tasker_id = parseInt(req.params.taskerId)

        const taskers_feedback = await FeedbackModel.getFeedback(tasker_id)

        res.status(200).json({tasker_feedback: taskers_feedback})
    }catch(error){
        console.error(error instanceof Error ? error.message : "Internal Server Error")
        res.status(500).json({error: "An Error Occured while retrieving Tasker/s Feedback. Please Try Again"})
    }
  }


  static async getFeedbacks(req: Request, res: Response): Promise<void> {
    try {
      console.log("Retrieving all tasker feedback...");
      const feedbacks = await FeedbackModel.getTaskerFeedback();
      console.log("Retrieved feedbacks:", feedbacks);
      res.status(200).json({ feedbacks });
    } catch (error) {
      console.error("Error in getFeedbacks:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default FeedbackController;