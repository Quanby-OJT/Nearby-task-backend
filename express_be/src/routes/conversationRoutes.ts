import { Router } from "express";
import ConversationController from "../controllers/conversartionController";

const router = Router();

//All COnversation Messages
router.post("/send-message", ConversationController.sendMessage);
router.get("/all-messages/:user_id", ConversationController.getAllMessages);
router.get("/messages/:task_taken_id", ConversationController.getMessages);
router.delete("/delete-message/:messageId", ConversationController.deleteConversation);