// controllers/userController.ts
import { Request, Response } from "express";
import FeedbackModel from "../models/feedbackModel";

class TaskerFeedbackController {
  static async createNewFeedback(req: Request, res: Response): Promise<void> {
    const { user_id, task_taken_id, rating, tasker_id, feedback } = req.body;

    try {
      await FeedbackModel.createNewFeedback(
        task_taken_id,
        feedback,
        rating,
        tasker_id
      );
      res.status(201).json({ message: "Successfully Rated the Tasker. Your rating to them will affect future prospects." });
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({
        error: "An Error Occured while sending your feedback. Please Try Again. If the Issue persists, contact us.",
      });
    }
  }

  static async getTaskerFeedback(req: Request, res: Response): Promise<void> {
    const taskerId = parseInt(req.params.tasker_id); // Get taskerId from URL parameter

    try {
      const feedbackData = await FeedbackModel.getTaskerFeedback(taskerId);

      res.status(200).json({ feedback: feedbackData });
    } catch (error) {
      console.error("Error fetching tasker feedback:", error);
      res.status(500).json({
        error: "An Error Occured while retrieiving the tasker's feedback. Please Try Again.",
      });
    }
  }
}

export default TaskerFeedbackController;
