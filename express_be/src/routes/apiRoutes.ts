import { Router } from "express";
import AuthenticationController from "../controllers/authenticationController";
import { validateLogin, validateOTP } from "../validator/authValidator";
import { handleValidationErrors } from "../middleware/validationMiddleware";
import UserAccountController from "../controllers/userAccountController";
import { userValidation } from "../validator/userValidator";
import ProfileController from "../controllers/profileController";
import { clientValidation, taskerValidation } from "../validator/userValidator";
import TaskController from "../controllers/taskController";
import { isAuthenticated } from "../middleware/authenticationMiddleware";
import ConversationController from "../controllers/conversartionController";

const router = Router();

/** Authentication Routes */
router.post("/login-auth", validateLogin, handleValidationErrors, AuthenticationController.loginAuthentication);
router.post("/otp-auth",validateOTP, handleValidationErrors, AuthenticationController.otpAuthentication);
router.post( "/reset", AuthenticationController.generateOTP)

router.post("/create-new-account", userValidation, handleValidationErrors, UserAccountController.registerUser)
router.post("/create-new-client", clientValidation, ProfileController.ClientController.createClient)
router.post("/create-new-tasker", taskerValidation, ProfileController.TaskerController.createTasker)

//router.post("/verify", UserAccountController.verifyEmail)

router.get("/check-session", (req, res) => {
  res.json({ sessionUser: req.session || "No session found" });
});

router.post("/logout", AuthenticationController.logout);

router.use(isAuthenticated);

/**
 * Application Routes (if the user is authenticated). All routes beyond this point had a middleware 
 * 
 * */
router.post("/addTask", TaskController.createTask);
router.get("/displayTask", TaskController.getAllTasks);
// router.get("/displayTask/:id", TaskController.getTask);
router.patch("/displayTask/:id/disable", TaskController.disableTask);
router.get('/displayTask/:clientId', TaskController.getTaskforClient)
router.post('/send-message', ConversationController.sendMessage)
router.get('/messages/:user_id/:task_taken_id', ConversationController.sendMessage)

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);
router.get("/specializations", TaskController.getAllSpecializations)
router.delete("/deleteUser/:id", UserAccountController.deleteUser);
router.get("/getUserData/:id", UserAccountController.getUserData);
router.get("/get-specializations", TaskController.getAllSpecializations)
// router.put("/updateUserInfo/:id/", upload.single("image"),UserAccountController.updateUser)

export default router;
