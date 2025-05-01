import { Router } from "express";
import TaskController from "../controllers/taskController";
import multer, { memoryStorage } from "multer";
const upload = multer({ storage: memoryStorage() });

const router = Router();

router.post("/addTask", TaskController.createTask);

router.get("/displayTask", TaskController.getAllTasks);

router.patch("/displayTask/:id", TaskController.disableTask);

router.get("/displayTask/:id", TaskController.getTaskById);

router.delete("/deleteTask/:id", TaskController.deleteTask);

router.get("/task-taken/tasker/:taskerId", TaskController.getTaskforTasker);

router.get("/getCreatedTaskByClient/:client_id", TaskController.getCreatedTaskByClient);

router.post("/check-task-assignment/:taskId/:taskerId", TaskController.checkTaskAssignment);

router.put("/updateTask/:id", TaskController.updateTask);

router.get("/document-link/:id", TaskController.getDocumentLink);

router.put(
  "/update-tasker-with-images/:id",
  upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "documentImage", maxCount: 1 }
  ]),
  TaskController.updateTaskerProfile
);

router.put("/update-tasker-profile/:id", TaskController.updateTaskerProfileNoImages);

// New routes for specialization Parts Ito
router.get("/specializations", TaskController.getAllSpecializations);

router.post("/specializations", TaskController.createSpecialization);

router.post("");

export default router;