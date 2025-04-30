// controllers/userController.ts
import { Request, Response } from "express";
import ClientTaskerModeration from "../models/moderationModel";
import PayMongoPayment from "../models/paymentModel";
import taskModel from "../models/taskModel";
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

  static async updateDispute(req: Request, res: Response): Promise<void> {
    try{
      console.log("Updating dispute with the Information..." + req.body)
      const {task_taken_id, task_status, task_id, moderator_id, moderator_action, addl_dispute_notes} = req.body
      const dispute_id = parseInt(req.params.id)

      switch(moderator_action){
        case "refund_tokens":
          await PayMongoPayment.refundCreditstoClient(task_taken_id, task_id)
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Refund NearByTask Tokens to Client", addl_dispute_notes, moderator_id)
          break;
        case "release_half":
          await PayMongoPayment.releaseHalfCredits(task_taken_id, task_status)
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Release Half of the Total Payment to Tasker", addl_dispute_notes, moderator_id)
          break;
        case "release_full":
          const task = await taskModel.getTaskAmount(task_taken_id);
          
          await PayMongoPayment.releasePayment({
            client_id: task?.post_task.client_id,
            transaction_id: "Id from Xendit", //Temporary value
            amount: task?.post_task.proposed_price ?? 0,
            payment_type: "Release of Payment to Tasker",
            deposit_date: new Date().toISOString(),
          });

          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, "Release Full Payment to Tasker", addl_dispute_notes, moderator_id)
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
