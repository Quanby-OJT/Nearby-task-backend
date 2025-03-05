import { Router } from "express";
import auth from "../controllers/authAngularController";
const router = Router();

/** Authentication Routes */

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.post("/logout-without-session", auth.logoutWithoutSession);
router.post("/userInformation", auth.userInformation);

export default router;
