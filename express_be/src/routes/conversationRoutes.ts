import { Router } from "express";
import ConversationController from "../controllers/conversartionController";

const router = Router();


router.get("/getUserConversation", ConversationController.getUserConversation); 

export default router;