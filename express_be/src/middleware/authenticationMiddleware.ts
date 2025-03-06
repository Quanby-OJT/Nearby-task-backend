import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/configuration";

export async function isAuthenticated(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const sessionToken = req.headers.authorization || req.cookies?.session;

        // Ensure sessionToken exists before calling .startsWith()
        if (!sessionToken) {
            res.status(401).json({ error: "Unauthorized: No session token provided" });
            return;
        }

        //console.log(sessionToken)
        let session_id = ""
        if(sessionToken.startsWith("Bearer ")){
            session_id = sessionToken.replace("Bearer ", "").trim()
        }
        //console.log(session_id)

        if (!sessionToken) {
            res.status(401).json({ error: "Unauthorized: No session token provided" });
            return;
        }

        const { data: userLog, error } = await supabase
            .from("user_logs")
            .select("user_id")
            .eq("session", session_id)
            .single();
        //console.log(userLog, error);

        if (error || !userLog) {
            res.status(401).json({ error: "Unauthorized: Invalid session" });
            return;
        }

        //(req as any).user_id = userLog.user_id;
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
