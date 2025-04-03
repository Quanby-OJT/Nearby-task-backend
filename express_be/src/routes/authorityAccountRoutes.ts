import { Router } from "express";
import AuthorityAccountController from "../controllers/authorityAccountController";
import multer, { memoryStorage } from "multer";
import { isAuthenticated } from "../middleware/authenticationMiddleware";

const upload = multer({ storage: memoryStorage() });

const router = Router();

// Protect the route with authentication middleware
router.use(isAuthenticated);

// Route for adding an authority user (Admin/Moderator)
router.post("/authorityAdd", upload.single("image"), AuthorityAccountController.addAuthorityUser);

export default router;