import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
const notificationController = new NotificationController();

// Test notification endpoint
router.post('/test', notificationController.testNotification.bind(notificationController));

router.post('/task', notificationController.sendTaskNotification.bind(notificationController));

// Send broadcast announcement to all users
router.post('/broadcast', notificationController.broadcastAnnouncement.bind(notificationController));

export default router; 