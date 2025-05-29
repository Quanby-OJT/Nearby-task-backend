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
import NotificationController from "../controllers/notificationController";
import ScheduleController from "../controllers/scheduleController";
import FeedbackController from "../controllers/feedbackController";
import SettingController from "../controllers/settingController";
import PaymentController from "../controllers/paymentController";
import AuthorityAccountController from "../controllers/authorityAccountController";
import UserLogsController from "../controllers/userlogController";

const upload = multer({ storage: memoryStorage() });

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

// New routes for forgot password (for AngularJS only)
router.post(
  "/authority/forgot-password/send-otp",
  AuthorityAccountController.sendOtp
);
router.post(
  "/authority/forgot-password/verify-otp",
  AuthorityAccountController.verifyOtp
);
router.post(
  "/authority/forgot-password/reset-password",
  AuthorityAccountController.resetPassword
);

// New route for forget password (for Flutter Only)
router.post("/forgot-password", AuthenticationController.forgotPassword);
router.post("/verify", UserAccountController.verifyEmail);
router.post("/reset-password", AuthenticationController.resetPassword);
// router.use(isAuthenticated);

/**
 * Application Routes (if the user is authenticated). All routes beyond this point had a middleware
 *
 * */

//For client and tasker, part of the creation is uploading their image and relevant documents.
router.post(
  "/create-new-client",
  clientValidation,
  upload.fields([{ name: "image", maxCount: 1 }]),
  ProfileController.ClientController.createClient
);

router.post(
  "/create-new-tasker",
  taskerValidation,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  ProfileController.TaskerController.createTasker
);

router.post("/verify", UserAccountController.verifyEmail);
router.put("/update-client-user/:id", UserAccountController.updateUser);

router.get("/check-session", (req, res) => {
  res.json({ sessionUser: req.session || "No session found" });
});

//Webhooks
router.get(
  "/payment/:amount/:payment_intent_id",
  PaymentController.redirectToApplication
);
router.put(
  "/webhook/paymongo/:id/:transaction_id",
  PaymentController.handlePayMongoWebhook
);

router.use(isAuthenticated);
router.post(
  "/userAdd",
  upload.single("image"),
  UserAccountController.registerUser
);
router.post("/addTask", upload.single("photo"), TaskController.createTask);
router.get("/displayTask", TaskController.getAllTasks);
router.get("/fetchTasks", TaskController.fetchAllTasks);
router.get(
  "/displayTaskWithSpecialization",
  TaskController.getTaskWithSpecialization
);
router.get("/displayTask/:id", TaskController.getTaskById);
// router.put("/displayTask/:id", TaskController.disableTask);
router.get(
  "/display-task-for-client/:clientId",
  TaskController.getTaskforClient
);

router.get(
  "/display-task-for-client-available/:clientId",
  TaskController.getTaskforClientAvailable
);

router.post("/assign-task", TaskController.assignTask);
router.get("/fetchIsApplied", TaskController.fetchIsApplied);
router.get(
  "/display-assigned-task/:task_taken_id",
  TaskController.getAssignedTaskbyId
);

//Tasker Status Update
router.put(
  "/update-status-tasker/:requestId",
  TaskController.updateTaskStatusforTasker
);
router.post("/update-status-client", TaskController.updateTaskStatusforClient);

// Feedback
router.post("/rate-the-tasker", FeedbackController.postClientFeedbacktoTasker);
router.get("/get-taskers-feedback/:taskerId",FeedbackController.getFeedbackForTasker);
router.get('/get-client-feedback/:id', FeedbackController.getFeedbackForClient)
router.get("/get-all-tasker-feedback", FeedbackController.getFeedbacks);

router.post("/set-tasker-schedule", ScheduleController.scheduleTask);
router.get(
  "/get-tasker-schedule/:tasker_id",
  ScheduleController.displaySchedules
);
router.delete("/delete-tasker-schedule/:id", ScheduleController.deleteSchedule);
router.put("/edit-tasker-schedule/:id", ScheduleController.editSchedule);
router.post("/reschedule-task", ScheduleController.rescheduleTask);

router.get("/get-token-balance/:userId", TaskController.getTokenBalance);

//Conversation(Client&Moderator)
router.get("/getUserConversation", ConversationController.getUserConversation);
router.post("/banUser/:id", ConversationController.banUser);
router.post("/warnUser/:id", ConversationController.warnUser);

// Display all records
router.get("/userDisplay", UserAccountController.getAllUsers);
router.get("/specializations", TaskController.getAllSpecializations);
router.delete("/deleteUser/:id", UserAccountController.deleteUser);
router.get("/getUserData/:id", UserAccountController.getUserData);
router.get("/get-specializations", TaskController.getAllSpecializations);
router.put(
  "/updateUserInfo/:id/",
  upload.single("image"),
  UserAccountController.updateUser
);

// Notifications for request
router.get(
  "/notifications-tasker-request/:userId",
  NotificationController.getTaskerRequest
);
router.get(
  "/notifications-tasker-confirmed/:userId",
  NotificationController.getConfirmedRequests
);
router.get(
  "/notifications-tasker-ongoing/:userId",
  NotificationController.getOngoingRequests
);
router.get(
  "/notifications-tasker-review/:userId",
  NotificationController.getReviewRequests
);
router.get(
  "/notifications-tasker-reject/:userId",
  NotificationController.getRejectedRequests
);
router.get(
  "/notifications-tasker-cancel/:userId",
  NotificationController.getCancelledRequests
);
router.get(
  "/notifications-tasker-pending/:userId",
  NotificationController.getPendingRequests
);
router.get(
  "/notifications-tasker-finish/:userId",
  NotificationController.getFinishRequests
);
router.get(
  "/notifications-tasker-disputed/:userId",
  NotificationController.getDisputedRequests
);
router.get(
  "/notifications-tasker-disputed-settled/:userId",
  NotificationController.getDisputedSettledRequests
);
router.get(
  "/displayRequest/:requestId",
  NotificationController.getTaskerRequestById
);
router.put(
  "/update-request/:taskTakenId",
  upload.fields([
    { name: "imageEvidence", maxCount: 10 }, 
  ]),
  NotificationController.updateRequest
);
router.put("/set-location/:user_id", SettingController.setLocation);
router.get("/get-location/:user_id", SettingController.getLocation);
router.put(
  "/update-specialization/:user_id",
  SettingController.updateSpecialization
);
router.put("/set-default-address/:user_id", SettingController.setLocationAsDefault);
router.put("/update-distance/:user_id", SettingController.updateDistance);
router.get("/get-address/:user_id", SettingController.getAddress);
router.get("/get-addresses/:user_id", SettingController.getAddresses);
router.put("/set-address/:user_id", SettingController.setAddress);
router.put("/update-address/:user_id", SettingController.updateAddress);
router.delete("/delete-address/:id", SettingController.deleteAddress);

// User Task
router.get("/fetchTasks/:userId", TaskController.getTasks);

router.get("/fetchTasksClient/:userId", TaskController.getTasksClient);
router.get("/tasker/taskinformation/:taskId", TaskController.getTaskInformation);

//User CRUD
router.put(
  "/user/client/:id",
  upload.fields([{ name: "image", maxCount: 1 }]),
  profileController.ClientController.updateClient
);
router.put(
  "/user/tasker/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "documents", maxCount: 10 }, // Adjust maxCount as needed
  ]),
  profileController.TaskerController.updateTasker
);

router.put(
  "/update-tasker-login-with-file/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "documents", maxCount: 1 },
  ]),
  profileController.TaskerController.updateTaskerLogin
);

router.post("/logout", AuthenticationController.logout);

// updating client with both profile and ID images
router.put(
  "/update-user-with-images/:id",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "idImage", maxCount: 1 },
  ]),
  UserAccountController.updateUserWithImages
);

// updating tasker with both profile and PDF images
router.put(
  "/update-tasker-with-file-profile/:id",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  UserAccountController.updateTaskerWithFileandImage
);

// updating tasker with PDF only
router.put(
  "/update-tasker-with-pdf/:id",
  upload.fields([{ name: "file", maxCount: 1 }]),
  UserAccountController.updateTaskerWithPDF
);

// updating tasker with only profile image and user details
router.put(
  "/update-tasker-with-image-profile/:id",
  upload.fields([{ name: "image", maxCount: 1 }]),
  UserAccountController.updateTaskerWithProfileImage
);

router.post("/generate-ai-text", FeedbackController.generateAIText);

// updating client with profile image only
router.put(
  "/update-user-with-profile-image/:id",
  upload.fields([{ name: "profileImage", maxCount: 1 }]),
  UserAccountController.updateUserWithProfileImage
);

// updating client with ID image only
router.put(
  "/update-user-with-id-image/:id",
  upload.fields([{ name: "idImage", maxCount: 1 }]),
  UserAccountController.updateUserWithIdImage
);

router.get("/getUserDocuments/:id", UserAccountController.getUserDocs);

// Submit user verification to the user_verify table
router.post(
  "/submit-user-verification/:id",
  upload.fields([
    { name: "idImage", maxCount: 1 }, // ID image
    { name: "selfieImage", maxCount: 1 }, // Selfie image
    { name: "documents", maxCount: 1 }, // Certificates file
  ]),
  UserAccountController.submitUserVerification
);

// Get user verification status
router.get(
  "/user-verification-status/:id",
  UserAccountController.getUserVerificationStatus
);

// Keep old routes for backward compatibility
router.post(
  "/submit-tasker-verification/:id",
  upload.fields([
    { name: "idImage", maxCount: 1 }, // ID image
    { name: "selfieImage", maxCount: 1 }, // Selfie image
    { name: "documents", maxCount: 1 }, // Certificates file
  ]),
  UserAccountController.submitUserVerification
);

// Get tasker verification status (kept for backward compatibility)
router.get(
  "/tasker-verification-status/:id",
  UserAccountController.getUserVerificationStatus
);

export default router;
