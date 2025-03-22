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

interface TaskerWithUser {
  user_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
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

  async getAllTaskersWithUsers(): Promise<TaskerWithUser[]> {
    const { data, error } = await supabase
      .from("tasker")
      .select(`
        user_id,
        user:user (first_name, middle_name, last_name)  // Changed 'users' to 'user'
      `);

    if (error) {
      console.error("Supabase fetch taskers error:", error);
      throw new Error(error.message);
    }

    console.log("Raw Supabase data:", data); // Log raw data for debugging

    const taskers: TaskerWithUser[] = data
      .filter((tasker: any) => tasker.user !== null) // Filter out taskers with no user
      .map((tasker: any) => ({
        user_id: tasker.user_id,
        first_name: tasker.user?.first_name ?? "Unknown",
        middle_name: tasker.user?.middle_name ?? "",
        last_name: tasker.user?.last_name ?? "Unknown",
      }));

    console.log("Mapped taskers:", taskers); // Log mapped data for debugging

    return taskers;
  }
}

const reportModel = new ReportModel();
export default reportModel;