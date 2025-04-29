import { Request, Response } from "express";
import { supabase } from "../config/configuration";
class UserController {

  static async create(req: Request, res: Response): Promise<void> {}

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await supabase.from("user").select();

      if (error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(200).json({ users: data });
      }
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export default UserController;
