import { Request, Response } from "express";
import multer from "multer";
import mime from "mime-types";
import reportModel from "../models/reportModel";
import { supabase } from "../config/configuration";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("images[]", 5);

class ReportController {
  // Client and Tasker 
  static async createReport(req: Request, res: Response): Promise<void> {
    try {
      console.log("Received report data:", req.body);
      console.log("Received files:", req.files);

      const { reported_by, reported_whom, reason } = req.body;
      const files = req.files as Express.Multer.File[];

      let reportedById: number | undefined;
      if (reported_by) {
        reportedById = parseInt(reported_by, 10);
        if (isNaN(reportedById)) {
          res.status(400).json({
            success: false,
            message: "Invalid reported_by ID",
          });
          return;
        }
      } else {
        console.log("reported_by is missing in request body");
      }

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
      } else {
        console.log("reported_whom is missing in request body");
      }

      let imageUrls: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = `${Date.now()}_${file.originalname}`;
          const contentType = mime.lookup(file.originalname) || "image/jpeg";

          const { data, error } = await supabase.storage
            .from("reports")
            .upload(fileName, file.buffer, {
              contentType: contentType,
              cacheControl: "3600",
              upsert: false,
            });

          if (error) {
            console.error("Error uploading image:", error);
            res.status(500).json({
              success: false,
              message: "Error uploading images",
            });
            return;
          }

          const { data: publicUrlData } = supabase.storage
            .from("reports")
            .getPublicUrl(data.path);

          if (publicUrlData) {
            imageUrls.push(publicUrlData.publicUrl);
          }
        }
      }

      const newReports = await reportModel.createReport(
        reportedById,
        reportedWhomId,
        reason,
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

  static async getAllTaskers(req: Request, res: Response): Promise<void> {
    try {
      const taskers = await reportModel.getAllTaskersWithUsers();
      res.status(200).json({
        success: true,
        taskers: taskers,
      });
    } catch (error) {
      console.error("Error fetching taskers:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getAllClients(req: Request, res: Response): Promise<void> {
    try {
      const clients = await reportModel.getAllClientsWithUsers();
      res.status(200).json({
        success: true,
        clients: clients,
      });
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Moderator and Admin
  static async getAllReports(req: Request, res: Response) {
    try {
      const reports = await reportModel.getAllReports();
      console.log("Fetched Data: ", reports);
      res.status(200).json({
        success: true,
        reports: reports,
      });
    } catch (error) {
      console.error("Failed to getch reports: ", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown Error Occurred",
      });
    }
  }

  static async updateReportStatus(req: Request, res: Response) {
    console.log("Data Header Received From Report Service: ", req.headers);
    console.log("Data Body Received From Report Service: ", req.body);
  
    try {
      const reportId = parseInt(req.params.reportId, 10);
      const { status, moderatorId } = req.body;
      const actionBy = moderatorId?.actionBy;
  
      // Validate reportId
      if (isNaN(reportId)) {
        res.status(400).json({
          success: false,
          message: "Invalid report ID",
        });
        return;
      }
  
      // Validate status
      if (typeof status !== "boolean") {
        res.status(400).json({
          success: false,
          message: "Status must be a boolean",
        });
        return;
      }
  
      // Validate actionBy
      if (typeof actionBy !== "number") {
        res.status(400).json({
          success: false,
          message: "actionBy must be a number",
        });
        return;
      }
  
      // Update the report with status and actionBy
      const updatedReport = await reportModel.updateReportStatus(reportId, status, actionBy);
  
      res.status(200).json({
        success: true,
        message: "Report status updated successfully",
        report: updatedReport,
      });
    } catch (error) {
      console.error("Failed to update report status: ", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Unknown Error Occurred",
      });
    }
  }
}

export default ReportController;