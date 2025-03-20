// reportController.ts
import { Request, Response } from "express";
import multer from "multer";
import mime from "mime-types"; // Import mime-types library
import reportModel from "../models/reportModel";
import { supabase } from "../config/configuration";

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
}).array("images[]", 5); // Expect an array of files under the key "images[]", max 5 files

class ReportController {
  static async createReport(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received report data:", req.body);

      // Extract data from the request
      const { reported_whom, reason } = req.body;
      const files = req.files as Express.Multer.File[];

      // Parse reported_whom if provided
      let reportedWhomId: number | undefined;
      if (reported_whom) {
        reportedWhomId = parseInt(reported_whom, 10);
        if (isNaN(reportedWhomId)) {
          res.status(400).json({
            success: false,
            message: "Invalid reported_whom ID",
          });
          return;
        }
      }

      // Upload images to Supabase Storage (bucket: "reports")
      let imageUrls: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = `${Date.now()}_${file.originalname}`; // Changed to match UserController format
          // Determine the content type using mime-types based on the file extension
          const contentType = mime.lookup(file.originalname) || "image/jpeg"; // Fallback to image/jpeg if unknown

          const { data, error } = await supabase.storage
            .from("reports")
            .upload(fileName, file.buffer, {
              contentType: contentType, // Explicitly set the content type
              cacheControl: "3600",
              upsert: false, // Changed to match UserController
            });

          if (error) {
            console.error("Error uploading image:", error);
            res.status(500).json({
              success: false,
              message: "Error uploading images",
            });
            return;
          }

          // Get the public URL of the uploaded image using data.path
          const { data: publicUrlData } = supabase.storage
            .from("reports")
            .getPublicUrl(data.path);

          if (publicUrlData) {
            imageUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      // Create the report(s) using the model
      const newReports = await reportModel.createReport(
        undefined, // reported_by (no authentication for now)
        reportedWhomId, // May be undefined if not provided
        reason, // May be undefined if not provided
        imageUrls.length > 0 ? imageUrls : undefined
      );

      res.status(201).json({
        success: true,
        message: "Report(s) created successfully",
        reports: newReports,
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static uploadReportImages(req: Request, res: Response, next: Function) {
    upload(req, res, (err) => {
      if (err) {
        res.status(400).json({
          success: false,
          message: err.message || "Error uploading images",
        });
        return;
      }
      next();
    });
  }
}

export default ReportController;