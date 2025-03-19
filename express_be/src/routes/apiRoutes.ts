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
import multer, { memoryStorage } from "multer";

const upload = multer({storage: memoryStorage()})

const router = Router();

/** Authentication Routes */
router.post(
  "/login-auth",
  validateLogin,
  handleValidationErrors,
  AuthenticationController.loginAuthentication
);
router.post(
  "/otp-auth",
  validateOTP,
  handleValidationErrors,
  AuthenticationController.otpAuthentication
);
router.post("/reset", AuthenticationController.generateOTP);

//Creating a New Account
router.post( 
  "/create-new-account", 
  userValidation, 
  handleValidationErrors, 
  UserAccountController.registerUser
);



router.post("/verify", UserAccountController.verifyEmail)
router.use(isAuthenticated);

/**
 * Application Routes (if the user is authenticated). All routes beyond this point had a middleware
 *
 * */

//For client and tasker, part of the creation is uploading their image and relevant documents.
router.post(
  "/create-new-client",
  clientValidation,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 }
  ]),
  ProfileController.ClientController.createClient
);

router.post(
  "/create-new-tasker",
  taskerValidation,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 }
  ]),
  ProfileController.TaskerController.createTasker
);

router.post("/verify", UserAccountController.verifyEmail);

router.get("/check-session", (req, res) => {
  res.json({ sessionUser: req.session || "No session found" });
});

router.post("/logout", AuthenticationController.logout);

router.use(isAuthenticated);

router.post("/addTask", TaskController.createTask);
router.get("/displayTask", TaskController.getAllTasks);
router.get("/displayTask/:id", TaskController.getTaskById);
router.patch("/displayTask/:id/disable", TaskController.disableTask);
router.get("/display-task-for-client/:clientId", TaskController.getTaskforClient);
router.post("/assign-task", TaskController.assignTask);
router.post("/send-message", ConversationController.sendMessage);
router.get("/all-messages/:user_id", ConversationController.getAllMessages);
router.get("/messages/:task_taken_id", ConversationController.getMessages);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);
router.get("/specializations", TaskController.getAllSpecializations);
router.delete("/deleteUser/:id", UserAccountController.deleteUser);
router.get("/getUserData/:id", UserAccountController.getUserData);
router.get("/get-specializations", TaskController.getAllSpecializations);
// router.put("/updateUserInfo/:id/", upload.single("image"),UserAccountController.updateUser)
router.post("/logout", AuthenticationController.logout);

export default router;
