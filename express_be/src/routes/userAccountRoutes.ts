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

// Test and debug routes
router.get("/test-image-document-tables", isAuthenticated, UserAccountController.testImageDocumentTables);
router.get("/test-user-verify/:id?", isAuthenticated, UserAccountController.testUserVerifyTable);
router.post("/debug-user-verify/:id?", isAuthenticated, UserAccountController.debugUserVerifyInsert);

// Verification routes (with file uploads)
router.post("/submit-verification/:id", isAuthenticated, upload.fields([
  { name: 'idImage', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 },
  { name: 'documents', maxCount: 1 }
]), UserAccountController.submitUserVerification);
router.get("/verification-status/:id", isAuthenticated, UserAccountController.getUserVerificationStatus);

export default router;