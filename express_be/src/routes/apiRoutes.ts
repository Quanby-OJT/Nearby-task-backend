import { Router } from "express";
import AuthenticationController from "../controllers/authenticationController";
import { validateLogin, validateOTP } from "../validator/authValidator";
import { handleValidationErrors } from "../middleware/validationMiddleware";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import TaskController from "../controllers/taskController";
import UserAccountController from "../controllers/userAccountController";
import ProfileController from "../controllers/profileController";
import multer from "multer";
import { taskerValidation, userValidation, clientValidation } from "../validator/userValidator";
import { validateTask } from "../validator/taskValidator";

const router = Router();

/** Authentication Routes */
router.post("/login-auth", validateLogin, handleValidationErrors, AuthenticationController.loginAuthentication);
router.post("/otp-auth",validateOTP, handleValidationErrors, AuthenticationController.otpAuthentication);
router.post( "/reset", AuthenticationController.generateOTP)

router.post("/create-new-account", userValidation, handleValidationErrors, UserAccountController.registerUser)
router.post("/verify", UserAccountController.verifyEmail)

router.get("/check-session", (req, res) => {
  res.json({ sessionUser: req.session || "No session found" });
});

router.post("/logout", AuthenticationController.logout);

router.use(isAuthenticated);

/**
 * Application Routes (if the user is authenticated). All routes beyond this point had a middleware 
 * 
 * */
router.post("/create-new-tasker", taskerValidation, ProfileController.TaskerController.createTasker)

router.post("/create-new-client", clientValidation, ProfileController.ClientController.createClient)
router.post("/addTask", validateTask, handleValidationErrors, TaskController.createTask);
router.get("/displayTask", TaskController.getAllTasks);
// router.get("/displayTask/:id", TaskController.getTask);
router.patch("/displayTask/:id/disable", TaskController.disableTask);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);
router.get("/specializations", TaskController.getAllSpecializations)
router.delete("/deleteUser/:id", UserAccountController.deleteUser);
router.get("/getUserData/:id", UserAccountController.getUserData);
router.get("/get-specializations", TaskController.getAllSpecializations)
// router.put("/updateUserInfo/:id/", upload.single("image"),UserAccountController.updateUser)

export default router;
