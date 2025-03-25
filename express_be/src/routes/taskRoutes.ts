// routes/userRoutes.ts
import { Router } from "express";
import TaskController from "../controllers/taskController";
import multer, { memoryStorage } from "multer";
const upload = multer({storage: memoryStorage()})

const router = Router();

router.post("/addTask", TaskController.createTask);

router.get("/displayTask", TaskController.getAllTasks);

router.get("/displayTask/:id", TaskController.getTaskById);

router.put("/disableTask/:id", TaskController.disableTask);

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

router.post("");

export default router;
