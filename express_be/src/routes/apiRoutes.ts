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
import auth from "../controllers/authAngularController";
import ConversationController from "../controllers/conversartionController";
import multer, { memoryStorage } from "multer";
import profileController from "../controllers/profileController";

const upload = multer({storage: memoryStorage()})

const router = Router();


/** Public Authentication Routes */
router.post("/login-angular", auth.login);

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
// router.use(isAuthenticated);

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
router.put("/update-client-user/:id", UserAccountController.updateUser);

router.get("/check-session", (req, res) => {
  res.json({ sessionUser: req.session || "No session found" });
});

router.use(isAuthenticated);

router.post("/addTask", TaskController.createTask);
router.get("/displayTask", TaskController.getAllTasks);
router.get("/displayTask/:id", TaskController.getTaskById);
//router.patch("/displayTask/:id/disable", TaskController.disableTask);
router.get("/display-task-for-client/:clientId", TaskController.getTaskforClient);
router.post("/assign-task", TaskController.assignTask);
router.get("/display-assigned-task/:task_taken_id", TaskController.getAssignedTaskbyId);
router.post("/send-message", ConversationController.sendMessage);
router.get("/all-messages/:user_id", ConversationController.getAllMessages);
router.get("/messages/:task_taken_id", ConversationController.getMessages);
router.put("/update-status-tasker/:requestId",  TaskController.updateTaskStatusforTasker);
router.post("/update-status-client", TaskController.updateTaskStatusforClient);
router.post("/deposit-escrow-payment", TaskController.createTaskPayment);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);
router.get("/specializations", TaskController.getAllSpecializations);
router.delete("/deleteUser/:id", UserAccountController.deleteUser);
router.get("/getUserData/:id", UserAccountController.getUserData);
router.get("/get-specializations", TaskController.getAllSpecializations);
// router.put("/updateUserInfo/:id/", upload.single("image"),UserAccountController.updateUser)
router.post("/logout", AuthenticationController.logout);

//User CRUD
router.put(
  "/user/client/:id", 
  upload.fields([    
    { name: "image", maxCount: 1 },
  ]),
  profileController.ClientController.updateClient);
router.put(
  "/user/tasker/:id",
  upload.fields([    
    { name: "image", maxCount: 1 },
    { name: "documents", maxCount: 10 } // Adjust maxCount as needed
  ]),
  profileController.TaskerController.updateTasker
);

router.post("/logout", AuthenticationController.logout);

// updating client with both profile and ID images
router.put(
  "/update-user-with-images/:id",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 }
  ]),
  UserAccountController.updateUserWithImages
);

// updating tasker with both profile and PDF images
router.put(
  "/update-tasker-with-file-profile/:id",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 }
  ]),
  UserAccountController.updateTaskerWithFileandImage
);


// updating tasker with PDF only
router.put(
  "/update-tasker-with-pdf/:id",
  upload.fields([
    { name: "file", maxCount: 1 }
  ]),
  UserAccountController.updateTaskerWithPDF
);


// updating tasker with only profile image and user details
router.put(
  "/update-tasker-with-image-profile/:id",
  upload.fields([
    { name: "image", maxCount: 1 }
  ]),
  UserAccountController.updateTaskerWithProfileImage
);










// updating client with profile image only
router.put(
  "/update-user-with-profile-image/:id",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
  ]),
  UserAccountController.updateUserWithProfileImage
);


// updating client with ID image only
router.put(
  "/update-user-with-id-image/:id",
  upload.fields([
    { name: "idImage", maxCount: 1 }
  ]),
  UserAccountController.updateUserWithIdImage
);

router.get("/getUserDocuments/:id", UserAccountController.getUserDocs);

export default router;