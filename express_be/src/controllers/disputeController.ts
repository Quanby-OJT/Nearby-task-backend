// controllers/userController.ts
import { Request, Response } from "express";
import ClientTaskerModeration from "../models/moderationModel";
import PayMongoPayment from "../models/paymentModel";
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
      const {task_taken_id, task_status, moderator_id, moderator_action, addl_dispute_notes} = req.body
      const dispute_id = parseInt(req.params.id)

      switch(moderator_action){
        case "Refund NearByTask Credits to Client":
          await PayMongoPayment.refundCreditstoClient(task_taken_id, task_status)
          await ClientTaskerModeration.updateADispute(task_taken_id, task_status, dispute_id, moderator_action, addl_dispute_notes, moderator_id)
      }
      
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
