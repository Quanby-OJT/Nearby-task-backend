import { Request, Response } from "express";
import UserLogModel from "../models/userlogModel";

class UserLogsController {
  static async displayLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await UserLogModel.getLogs();
      
      const formattedLogs = logs.map((log: any) => ({
        ...log,
        logged_in: log.logged_in ? new Date(log.logged_in).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
        logged_out: log.logged_out ? new Date(log.logged_out).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
      }));

      res.json(logs);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unknown error occurred" });
      }
    }
  }
}

export default UserLogsController;
