import { Request, Response } from "express";
import FeedbackModel from "../models/feedbackModel";
import OpenAI from "openai";

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

  /**
   * Implement here Generation of AI Texts for Tasker/Cient for the following:
   * 1. Tasker/Client Bio and Relevant Skills based on Specialization Given
   * 2. Client Task Description and remarks.
   * 3. Moderator Note for the following actions:
   * 
   * Note that this is only optional for the tasker and client to use.
   * @param req specialization, role, moderator_action
   * @param res ai_data
   */

  static async generateAIText(req: Request, res: Response): Promise<void> {
    try {
      const { specialization, role, moderator_action } = req.body;
      console.log(req.body)

      const client = new OpenAI();
      let ai_input = ""

      if(role === "Tasker"){
        ai_input = `Generate a tasker bio and relevant skills for the following specialization: ${specialization}`
      }else if(role === "Client"){
        ai_input = `Generate a task description and remarks for the following specialization: ${specialization}`
      }else if (role === "Moderator"){
        ai_input = `Generate me a Moderator Note for the following action: ${moderator_action}`
      }
      else {
        res.status(400).json({ error: "Invalid role. Please specify either 'Tasker' or 'Client'." });
        return;
      }

      const response = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: ai_input }],
      });
      const aiResponse = response.choices[0].message.content;
      if (!aiResponse) {
        res.status(400).json({ error: "Sorry, we cannot generate your content. Please Try Again." });
      }

      res.status(200).json({ ai_data: response.choices[0].message.content });
    } catch (error) {
      console.error("Error in postClientFeedbacktoTasker:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "An Error Occurred while Posting Feedback" });
    }
  }
}

export default FeedbackController;