// routes/userRoutes.ts
import { Router } from "express";
import DisputeController from "../controllers/disputeController";

const router = Router();
router.get('/get-all-disputes', DisputeController.getAllDisputes);
router.put('/update-dispute/:id', DisputeController.updateDispute);
router.delete('/delete-dispute/:id', DisputeController.deleteDispute);


export default router;
