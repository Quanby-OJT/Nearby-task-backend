// controllers/userController.ts
import { Request, Response } from "express";
import ClientTaskerModeration from "../models/moderationModel";
import QTaskPayment from "../models/paymentModel";
import taskModel from "../models/taskModel";
import { supabase } from "../config/configuration";
import cron from 'node-cron'

cron.schedule('0 * * * *', () => {
  DisputeController.autoResolveStaleDisputes()
})

class DisputeController {
  static async getAllDisputes(req: Request, res: Response): Promise<void> {
    try {
      const data = await ClientTaskerModeration.getAllDisputes()
      res.status(200).json({ message: "Disputes retrieved successfully", data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }

  static async getADispute(req: Request, res: Response): Promise<void> {
    try{
      const task_taken_id = parseInt(req.params.id)
      const dispute_details = await ClientTaskerModeration.getDispute(task_taken_id)

      if(dispute_details == null){
        res.status(200).json({message: "This task is not disputed or does not exist."})
        return
      }
      res.status(200).json({message: "Retrieved Disputes", dispute_details})
    }catch(error){
      console.error("Error in getting disputes..." , error instanceof Error ? error.message : "Error Unknown")
      res.status(500).json({error: "An Error Occured while displaying your dispute information. Please Try Again."})
    }
  }

  static async autoResolveStaleDisputes() {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleDisputes, error } = await supabase
      .from("dispute_logs")
      .select("dispute_id, task_taken_id")
      .eq("moderator_action", null)
      .lte("created_at", fourteenDaysAgo);

    if (error) {
      console.error("Failed to fetch stale disputes:", error.message);
      return;
    }

    for (const dispute of staleDisputes) {
      try {
        await QTaskPayment.releaseHalfCredits(dispute.task_taken_id);

        await ClientTaskerModeration.updateADispute(
          dispute.task_taken_id,
          "auto_resolved",
          dispute.dispute_id,
          "System Auto-Resolution",
          "Automatically released half payment to both parties after 14 days of no moderator action.",
          0 // no moderator_id
        );
      } catch (err) {
        console.error(`Failed to auto-resolve dispute ID ${dispute.dispute_id}:`, err instanceof Error ? err.message : "Unknown Error");
      }
    }
  }

  static async updateDispute(req: Request, res: Response): Promise<void> {
    try{
      console.log("Updating dispute with the Information...", req.body)
      const {task_taken_id, task_status, task_id, moderator_id, moderator_action, addl_dispute_notes} = req.body
      const dispute_id = parseInt(req.params.id)

      switch(moderator_action){
        case "refund_tokens":
          await QTaskPayment.refundCreditstoClient(task_taken_id, task_id)
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Refund Amount to Client", addl_dispute_notes, moderator_id)
          break;
        case "release_half":
          await QTaskPayment.releaseHalfCredits(task_taken_id)
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Split Amount between Tasker and Client", addl_dispute_notes, moderator_id)
          break;
        case "release_full":
          const task = await taskModel.getTaskAmount(task_taken_id);

          if(!task){
            res.status(500).json({error: "Unable to calculate the amount from the task. Please Try Again. Contact our support to resolve this."})
            return
          }

          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Release Full Payment to Tasker", addl_dispute_notes, moderator_id)
          const { error: updateAmountError } = await supabase.rpc(
            "increment_tasker_amount",
            {
              addl_credits: task?.post_task.proposed_price,
              id: task?.tasker.tasker_id,
            }
          );

          if (updateAmountError) {
            console.error(updateAmountError.message);
            res.status(500).json({
              success: false,
              error: "An Error Occurred while updating tasker amount.",
            });
            return;
          }
          break;
        case "reject_dispute":
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Reject Dispute", addl_dispute_notes, moderator_id)
          break;
        default:
          res.status(400).json({message: "Invalid moderator action"})
          return;
      }
      
      res.status(200).json({message: "Successfully updated the dispute"})
    }catch(error){
      console.error(error)
      res.status(500).json({message: "An Error Occured while updating Your Dispute. Please Try Again."})
    }
  }

  static async deleteDispute(req: Request, res: Response): Promise<void> {
    try {
      const dispute_id = parseInt(req.params.id);
      await ClientTaskerModeration.deleteDispute(dispute_id);
      res.status(200).json({ message: "Dispute deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
}

export default DisputeController;
