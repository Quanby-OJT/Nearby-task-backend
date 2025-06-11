import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

export class NotificationService {
    private static instance: NotificationService;
    private initialized = false;

    private constructor() {}

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public initialize(serviceAccount: ServiceAccount) {
        if (this.initialized) return;

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        this.initialized = true;
    }

    public async sendToDevice(token: string, notification: { title: string; body: string }, data?: Record<string, string>) {
        try {
            const message: admin.messaging.Message = {
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: data,
                token: token,
            };

            const response = await admin.messaging().send(message);
            return { success: true, messageId: response };
        } catch (error) {
            console.error('Error sending notification:', error);
            return { success: false, error };
        }
    }

    public async sendToTopic(topic: string, notification: { title: string; body: string }, data?: Record<string, string>) {
        try {
            const message: admin.messaging.Message = {
                notification: {
                    title: notification.title,
                    body: notification.body,
                },
                data: data,
                topic: topic,
            };

            const response = await admin.messaging().send(message);
            return { success: true, messageId: response };
        } catch (error) {
            console.error('Error sending notification to topic:', error);
            return { success: false, error };
        }
    }

    public async subscribeToTopic(tokens: string[], topic: string) {
        try {
            const response = await admin.messaging().subscribeToTopic(tokens, topic);
            return { success: true, response };
        } catch (error) {
            console.error('Error subscribing to topic:', error);
            return { success: false, error };
        }
    }

    public async unsubscribeFromTopic(tokens: string[], topic: string) {
        try {
            const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
            return { success: true, response };
        } catch (error) {
            console.error('Error unsubscribing from topic:', error);
            return { success: false, error };
        }
    }
} 