import { Request, Response } from "express";
import  ClientTaskerModeration from "../models/moderationModel"
import ConversationModel from "../models/conversartionModel";

class ModerationController {
    static async banUser(req: Request, res: Response): Promise<void> {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const result = await ClientTaskerModeration.banUser(userId);
            if (result) {
                res.status(200).json({ message: "User has been banned successfully" });
            } else {
                res.status(404).json({ error: "User not found" });
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }

    static async warnUser(req: Request, res: Response): Promise<void> {
        try {
            const userId = parseInt(req.params.id, 10);
            if (isNaN(userId)) {
                res.status(400).json({ error: "Invalid user ID" });
                return;
            }

            const result = await ClientTaskerModeration.warnUser(userId);
            if (result) {
                res.status(200).json({ message: "User has been warned successfully" });
            } else {
                res.status(404).json({ error: "User not found" });
            }
        } catch (error) {
            if (error instanceof Error) {
                res.status(500).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unknown error occurred" });
            }
        }
    }
}

export default ModerationController;