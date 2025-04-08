import { Router } from "express";
import ConversationController from "../controllers/conversartionController";

const router = Router();

router.get("/getUserConversation", ConversationController.getUserConversation); 

router.post("/banUser/:id", ConversationController.banUser); // Changed to POST and added :id
router.post("/warnUser/:id", ConversationController.warnUser); // Changed to POST and added :id

export default router;