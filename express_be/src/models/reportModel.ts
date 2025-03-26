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

interface ClientWithUser {
  user_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
}

class ReportModel {

// Client and Taskers

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
        status: false,
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
      status: false,
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
        user:user (first_name, middle_name, last_name)
      `);

    if (error) {
      console.error("Supabase fetch taskers error:", error);
      throw new Error(error.message);
    }

    console.log("Raw Supabase data (taskers):", data);

    const taskers: TaskerWithUser[] = data
      .filter((tasker: any) => tasker.user !== null)
      .map((tasker: any) => ({
        user_id: tasker.user_id,
        first_name: tasker.user?.first_name ?? "Unknown",
        middle_name: tasker.user?.middle_name ?? "",
        last_name: tasker.user?.last_name ?? "Unknown",
      }));

    console.log("Mapped taskers:", taskers);

    return taskers;
  }

  async getAllClientsWithUsers(): Promise<ClientWithUser[]> {
    const { data, error } = await supabase
      .from("clients")
      .select(`
        user_id,
        user:user (first_name, middle_name, last_name)
      `);

    if (error) {
      console.error("Supabase fetch clients error:", error);
      throw new Error(error.message);
    }

    console.log("Raw Supabase data (clients):", data);

    const clients: ClientWithUser[] = data
      .filter((client: any) => client.user !== null)
      .map((client: any) => ({
        user_id: client.user_id,
        first_name: client.user?.first_name ?? "Unknown",
        middle_name: client.user?.middle_name ?? "",
        last_name: client.user?.last_name ?? "Unknown",
      }));

    console.log("Mapped clients:", clients);

    return clients;
  }

  // Moderator and Admin

  async getAllReports() {
    try {
      const { data: reports, error: reportError } = await supabase
        .from("report")
        .select("*");
  
      if (reportError) {
        console.error("Supabase error fetching reports:", reportError);
        throw new Error(reportError.message);
      }
  
      if (!reports || reports.length === 0) {
        return [];
      }
  
      const userIds = [
        ...new Set([
          ...reports.map((report) => report.reported_by),
          ...reports.map((report) => report.reported_whom),
        ]),
      ].filter((id) => id !== null && id !== undefined);
  
      const { data: users, error: userError } = await supabase
        .from("user")
        .select("user_id, first_name, middle_name, last_name, user_role")
        .in("user_id", userIds);
  
      if (userError) {
        console.error("Supabase error fetching users:", userError);
        throw new Error(userError.message);
      }
  
      const userMap = new Map(users.map((user) => [user.user_id, user]));
  
      const combinedData = reports.map((report) => ({
        ...report,
        reporter: userMap.get(report.reported_by) || {
          user_id: report.reported_by,
          first_name: "Unknown",
          middle_name: "Unknown",
          last_name: "Unknown",
          user_role: "Unknown",
        },
        violator: userMap.get(report.reported_whom) || {
          user_id: report.reported_whom,
          first_name: "Unknown",
          middle_name: "Unknown",
          last_name: "Unknown",
          user_role: "Unknown",
        },
      }));
// Convert Date in Created_at Updated_at to a more ano readable way
      const formattedData = combinedData.map((report) => ({
        ...report,
        created_at: report.created_at
          ? new Date(report.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
          : null,
    //Update_at can be remove but for reference purpose i didn't remove it incase in the future we need to convert two date
        updated_at: report.updated_at
          ? new Date(report.updated_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
          : null,
      }));
// Pag pass of the data
      console.log("Combined reports with formatted dates:", formattedData);
      return formattedData;
    } catch (err) {
      console.error("Unexpected error in getAllReports:", err);
      throw err;
    }
  }
}

const reportModel = new ReportModel();
export default reportModel;