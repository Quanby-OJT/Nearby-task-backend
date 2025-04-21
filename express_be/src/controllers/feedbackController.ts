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

  
}

export default FeedbackController