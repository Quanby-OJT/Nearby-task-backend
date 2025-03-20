import { supabase } from "../config/configuration";

interface Report {
  report_id?: number; 
  created_at?: string;
  updated_at?: string; 
  reported_by?: number; 
  reported_whom?: number; 
  reason?: string; 
  status: boolean; 
  images?: string; 
}

class ReportModel {
  async createReport(
    reported_by: number | undefined,
    reported_whom: number | undefined,
    reason: string | undefined,
    imageUrls?: string[]
  ): Promise<Report[]> {
    if (!imageUrls || imageUrls.length === 0) {
      const reportData: Report = {
        reported_by,
        reported_whom,
        reason,
        status: true,
        images: undefined, 
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

    const reportRows = imageUrls.map((imageUrl) => ({
      reported_by,
      reported_whom,
      reason,
      status: true,
      images: imageUrl, 
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