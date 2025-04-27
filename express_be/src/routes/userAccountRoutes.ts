import { Router } from "express";
import UserAccountController from "../controllers/userAccountController";
import multer from "multer";
import AuthenticationController from "../controllers/authenticationController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Register user with image upload
router.post("/userAdd", upload.single("image"), UserAccountController.registerUser);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);

router.delete("/deleteUser/:id", UserAccountController.deleteUser);

router.get("/getUserData/:id", UserAccountController.getUserData);

router.get("/users", UserAccountController.getPaginationUsers);

router.put("/updateUserInfo/:id/", upload.single("image"), UserAccountController.updateUser);

router.post("/verify-otp", AuthenticationController.otpAuthentication);

// New routes for forgot password
router.post("/forgot-password/send-otp", UserAccountController.sendOtp);
router.post("/forgot-password/verify-otp", UserAccountController.verifyOtp);
router.post("/forgot-password/reset-password", UserAccountController.resetPassword);

export default router;