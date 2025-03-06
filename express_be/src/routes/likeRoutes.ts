import { Router } from "express";
import LikeController from "../controllers/likeController";

const router = Router();

router.post("/likeJob", LikeController.createLike);

router.delete("/unlikeJob", LikeController.deleteLike);

router.get("/displayLikedJob/:id", LikeController.getLikedJob);

export default router;
