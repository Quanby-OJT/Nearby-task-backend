import { Router } from "express";
import LikeController from "../controllers/likeController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import ClientController from "../controllers/clientController";

const router = Router();

router.get("/client/getAllTaskers", ClientController.getAllClients);
router.post("/liketasker", ClientController.createLike);
router.get("/client/getsavedTask/:id", ClientController.getLikedTask);
router.delete("/unlikeTask", ClientController.deleteLike);
router.get("/get")

export default router;
