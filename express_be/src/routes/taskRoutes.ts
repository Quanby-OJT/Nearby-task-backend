// routes/userRoutes.ts
import { Router } from "express";
import TaskController from "../controllers/taskController";


const router = Router();

router.post("/addTask", TaskController.createTask);

router.get("/displayTask", TaskController.getAllTasks);

router.get("/displayTask/:id", TaskController.getTaskById);

router.put("/disableTask/:id", TaskController.disableTask);


export default router;
