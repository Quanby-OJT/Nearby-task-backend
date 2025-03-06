// types/express.d.ts
import { Request } from "express";

declare module "express-serve-static-core" {
    interface Request {
        user_id?: number; // Define user_id as an optional property
    }
}
