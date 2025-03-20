// routes/userRoutes.ts
import { Router } from "express";
import TaskController from "../controllers/taskController";

const router = Router();

router.post("/addTask", TaskController.createTask);

router.get("/displayTask", TaskController.getAllTasks);

router.get("/displayTask/:id", TaskController.getTaskById);

router.delete("/deleteTask/:id", TaskController.deleteTask);

router.get("/getCreatedTaskByClient/:client_id", TaskController.getCreatedTaskByClient);

router.put("/updateTask/:id", TaskController.updateTask);

router.post("");

export default router;
