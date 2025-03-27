import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/configuration";

export async function isAuthenticated(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {   
        const sessionToken = req.headers.authorization || req.cookies?.session;

        //console.log("To be authenticated: " + sessionToken);
        
        if (!sessionToken) {
            res.status(401).json({ error: "Unauthorized: No session token provided" });
            return;
        }

        //console.log("Session token:", sessionToken);
        
        // Extract session_id from either Bearer token or directly from cookie
        let session_id = sessionToken;
        
        if (typeof sessionToken === 'string' && sessionToken.startsWith("Bearer ")) {
            session_id = sessionToken.replace("Bearer ", "").trim();
        }
        
        //console.log("Extracted session_id:", session_id);

        if (!session_id) {
            res.status(401).json({ error: "Unauthorized: No session token provided" });
            return;
        }

        const { data: userLog, error } = await supabase
            .from("user_logs")
            .select("user_id")
            .eq("session", session_id)
            .single();
            
        //console.log("User log:", userLog, "Error:", error);
        
        if(error){
            console.error(error instanceof Error, error.message ?? "Unable to Verify your session. Please Try Again.")
            res.status(401).json({ error: "Unable to Verify your session. Please Try Again." });
            return
        }else if (!userLog) {
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
