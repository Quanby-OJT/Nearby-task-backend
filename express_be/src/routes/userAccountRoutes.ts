// routes/userRoutes.ts
import { Router } from "express";
import UserAccountController from "../controllers/userAccountController";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Register user with image upload
router.post(
  "/userAdd",
  upload.single("image"),
  UserAccountController.registerUser
);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);

router.delete("/deleteUser/:id", UserAccountController.deleteUser);

router.get("/getUserData/:id", UserAccountController.getUserData);

router.post("/create-new-user", UserAccountController.registerUser);

router.post("/completeTaskerAccount", UserAccountController.createTasker)

router.get("/users", UserAccountController.getPaginationUsers);

router.put(
  "/updateUserInfo/:id/",
  upload.single("image"),
  UserAccountController.updateUser
);

router.post("/verify-otp", UserAccountController.verifyOtp);

export default router;
