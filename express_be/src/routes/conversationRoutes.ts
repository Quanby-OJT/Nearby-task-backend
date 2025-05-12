import { Router } from "express";
import ConversationController from "../controllers/conversartionController";

const router = Router();

//All COnversation Messages
router.post("/send-message", ConversationController.sendMessage);
router.get("/all-messages/:user_id", ConversationController.getAllMessages);
router.get("/messages/:task_taken_id", ConversationController.getMessages);
router.post("/mark-messages-read", ConversationController.markMessagesAsRead); // New endpoint
router.delete("/delete-message/:messageId", ConversationController.deleteConversation);

export default router;