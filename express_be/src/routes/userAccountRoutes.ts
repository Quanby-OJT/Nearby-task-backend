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

router.get("/users", UserAccountController.getPaginationUsers);

router.put(
  "/updateUserInfo/:id/",
  upload.single("image"),
  UserAccountController.updateUser
);

export default router;
