import { Router } from "express";
import LikeController from "../controllers/likeController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";

const router = Router();

// router.use(isAuthenticated);

router.post("/likeJob", LikeController.createLike);
router.delete("/unlikeJob", LikeController.deleteLike);
router.get("/displayLikedJob/:id", LikeController.getLikedJob);

export default router;
