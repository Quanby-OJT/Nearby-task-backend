// routes/userRoutes.ts
import { Router } from "express";

import multer from "multer";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import DisputeController from "../controllers/disputeController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/get-all-disputes', DisputeController.getAllDisputes);
router.get('/get-dispute/:id', DisputeController.getDisputeById);
router.put('/update-dispute/:id', DisputeController.updateDispute);


export default router;
