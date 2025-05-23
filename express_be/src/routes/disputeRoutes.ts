// routes/userRoutes.ts
import { Router } from "express";
import DisputeController from "../controllers/disputeController";

const router = Router();
router.get('/get-all-disputes', DisputeController.getAllDisputes);
router.get('/get-a-dispute/:id', DisputeController.getADispute)
router.put('/update-dispute/:id', DisputeController.updateDispute);
router.delete('/archive-dispute/:id', DisputeController.deleteDispute);


export default router;
