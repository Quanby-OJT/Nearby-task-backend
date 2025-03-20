// reportModel.ts
import { supabase } from "../config/configuration";

// Define the Report interface based on the updated Supabase table structure
interface Report {
  report_id?: number; // Auto-incremented by Supabase
  created_at?: string; // Set by Supabase
  updated_at?: string; // Set by Supabase
  reported_by?: number; // Foreign key (user who submitted the report), optional
  reported_whom?: number; // Foreign key (user being reported), optional
  reason?: string; // Description of the report, optional
  status: boolean; // True for active, false for resolved
  images?: string; // Changed from string[] to string (single URL)
}

class ReportModel {
  async createReport(
    reported_by: number | undefined,
    reported_whom: number | undefined,
    reason: string | undefined,
    imageUrls?: string[]
  ): Promise<Report[]> {
    // If there are no images, create a single report with no image
    if (!imageUrls || imageUrls.length === 0) {
      const reportData: Report = {
        reported_by,
        reported_whom,
        reason,
        status: true,
        images: undefined, // No image
      };

      console.log("Creating report with data (no images):", reportData);

      const { data, error } = await supabase
        .from("report")
        .insert([reportData])
        .select();

      if (error) {
        console.error("Supabase insertion error:", error);
        throw new Error(error.message);
      }

      return data;
    }

    // Create one report row per image, with images as a single string
    const reportRows = imageUrls.map((imageUrl) => ({
      reported_by,
      reported_whom,
      reason,
      status: true,
      images: imageUrl, // Store as a single string, not an array
    }));

    console.log("Creating report rows with data:", reportRows);

    const { data, error } = await supabase
      .from("report")
      .insert(reportRows)
      .select();

    if (error) {
        console.error("Supabase insertion error:", error);
        throw new Error(error.message);
    }

    return data;
  }
}

const reportModel = new ReportModel();
export default reportModel;