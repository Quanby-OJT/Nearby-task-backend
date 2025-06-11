import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
    private notificationService = NotificationService.getInstance();

    async testNotification(req: Request, res: Response) {
        try {
            const { token } = req.body;
            
            const result = await this.notificationService.sendToDevice(
                token,
                {
                    title: "Test Notification",
                    body: "This is a test notification. If you see this, notifications are working!"
                },
                {
                    type: "test",
                    screen: "home",
                    timestamp: new Date().toISOString()
                }
            );

            res.json({
                success: true,
                result,
                message: "Test notification sent successfully"
            });
        } catch (error: any) {
            console.error('Test notification error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to send test notification',
                details: error.message 
            });
        }
    }

    async sendTaskNotification(req: Request, res: Response) {
        try {
            const { userToken, taskTitle, taskId } = req.body;

            const result = await this.notificationService.sendToDevice(
                userToken,
                {
                    title: "New Task Assignment",
                    body: `You have been assigned: ${taskTitle}`
                },
                {
                    type: "task",
                    screen: "task-details",
                    taskId: taskId
                }
            );

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to send notification' });
        }
    }

    async broadcastAnnouncement(req: Request, res: Response) {
        try {
            const { title, message } = req.body;

            const result = await this.notificationService.sendToTopic(
                'all_users',
                {
                    title: title,
                    body: message
                },
                {
                    type: 'announcement',
                    screen: 'announcements'
                }
            );

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to send broadcast' });
        }
    }
} 