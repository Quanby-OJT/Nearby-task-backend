import { Router } from "express";
import LikeController from "../controllers/likeController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import ClientController from "../controllers/clientController";

const router = Router();

router.get("/client/getMyDataTasker/:userId", ClientController.getMyDataTasker);
router.get("/client/getMyDataClient/:userId", ClientController.getMyDataClient);

router.get(
    "/client/getAllFilteredTaskers",
    ClientController.getAllFilteredTaskers
  );


router.get("/client/getAllTaskers", ClientController.getAllClients);
router.get("/client/getAllTaskerbySpecialization", ClientController.getAllClientsBySpecialization);
router.post("/liketasker", ClientController.createLike);
router.get("/client/getsavedTask/:id", ClientController.getLikedTask);
router.delete("/unlikeTask", ClientController.deleteLike);
router.get("/get")

export default router;
