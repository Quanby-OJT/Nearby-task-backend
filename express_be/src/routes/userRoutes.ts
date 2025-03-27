// routes/userRoutes.ts
import { Router } from "express";
import UserController from "../controllers/userController";
import multer from "multer";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
const { supabase } = require("../config/configuration");

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Register user with image upload
// router.post("/add", upload.single("image"), UserController.registerUser);

// Display all records'
router.use(isAuthenticated);

router.get("/display", UserController.getAllUsers);


export default router;
