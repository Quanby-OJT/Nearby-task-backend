// routes/userRoutes.ts
import { Router } from "express";
import UserController from "../controllers/userController";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Register user with image upload
router.post("/add", upload.single("image"), UserController.registerUser);

// Display all records
router.get("/display", UserController.getAllUsers);

export default router;
