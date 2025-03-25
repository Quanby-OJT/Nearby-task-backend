import { Router } from "express";
import auth from "../controllers/authAngularController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";

const router = Router();

/** Public Authentication Routes */
router.post("/login-angular", auth.login);

router.use(isAuthenticated);

router.post("/logout-angular", auth.logout);
router.post("/logout-without-session", auth.logoutWithoutSession);
router.post("/userInformation", auth.userInformation);

export default router;
