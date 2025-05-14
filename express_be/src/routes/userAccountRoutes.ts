import { Router } from "express";
import UserAccountController from "../controllers/userAccountController";
import AuthenticationController from "../controllers/authenticationController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Routes requiring authentication
router.post("/userAdd", isAuthenticated, upload.single("image"), UserAccountController.registerUser);
router.get("/userDisplay", isAuthenticated, UserAccountController.getAllUsers);
router.delete("/deleteUser/:id", isAuthenticated, UserAccountController.deleteUser);
router.get("/getUserData/:id", isAuthenticated, UserAccountController.getUserData);
router.get("/users", isAuthenticated, UserAccountController.getPaginationUsers);
router.put("/updateUserInfo/:id/", isAuthenticated, upload.single("image"), UserAccountController.updateUser);
router.post("/verify-otp", isAuthenticated, AuthenticationController.otpAuthentication);

export default router;