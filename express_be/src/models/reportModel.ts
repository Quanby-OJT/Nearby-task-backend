import { supabase } from "../config/configuration";

// Interface for the report data structure
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

// Interface for taskers with user details
interface TaskerWithUser {
  user_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
}

// Interface for clients with user details
interface ClientWithUser {
  user_id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
}

// Interface for the report history response
interface ReportHistory {
  report_id: number;
  created_at: string;
  reported_by_name: string;
  reported_whom_name: string;
  reason: string;
  status: boolean;
}

// Interface for the user data structure
interface UserData {
  user_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
}

class ReportModel {
  /**
   * Creates a new report in the database.
   * @param reported_by - ID of the user making the report
   * @param reported_whom - ID of the user being reported
   * @param reason - Reason for the report
   * @param imageUrls - Optional array of image URLs related to the report
   * @returns Promise<Report[]> - Array of created report objects
   */
  async createReport(
    reported_by: number | undefined,
    reported_whom: number | undefined,
    reason: string | undefined,
    imageUrls?: string[]
  ): Promise<Report[]> {
    const reportData: Report = {
      reported_by,
      reported_whom,
      reason,
      status: false,
      images: imageUrls ? JSON.stringify(imageUrls) : undefined,
    };

    console.log("Creating report with data:", reportData);

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

  /**
   * Retrieves report history for a specific user.
   * @param userId - ID of the user whose report history is being fetched
   * @returns Promise<ReportHistory[]> - Array of report history objects
   */
  async getReportHistory(userId: number): Promise<ReportHistory[]> {
    try {
      // Fetch reports for the user
      const { data: reports, error: reportError } = await supabase
        .from("report")
        .select(`
          report_id,
          created_at,
          reason,
          status,
          reported_by,
          reported_whom
        `)
        .eq("reported_by", userId)
        .order("report_id", { ascending: true });

      if (reportError) {
        console.error("Supabase error fetching report history:", reportError);
        throw new Error(reportError.message);
      }

      if (!reports || reports.length === 0) {
        return [];
      }

      console.log("Raw reports from Supabase:", JSON.stringify(reports, null, 2));

      // Extract user IDs for reported_by and reported_whom
      const userIds = [
        ...new Set([
          ...reports.map((report) => report.reported_by),
          ...reports.map((report) => report.reported_whom),
        ]),
      ].filter((id) => id !== null && id !== undefined);

      // Fetch user details for these IDs
      const { data: users, error: userError } = await supabase
        .from("user")
        .select("user_id, first_name, middle_name, last_name")
        .in("user_id", userIds);

      if (userError) {
        console.error("Supabase error fetching users:", userError);
        throw new Error(userError.message);
      }

      // Create a map of user IDs to user details
      const userMap = new Map<number, UserData>(
        users.map((user) => [
          user.user_id,
          {
            user_id: user.user_id,
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
          },
        ])
      );

      // Map reports to ReportHistory format
      const formattedReports: ReportHistory[] = reports.map((report) => {
        const reporter = report.reported_by ? userMap.get(report.reported_by) : null;
        const violator = report.reported_whom ? userMap.get(report.reported_whom) : null;

        return {
          report_id: report.report_id,
          created_at: report.created_at
            ? new Date(report.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
            : "N/A",
          reported_by_name: reporter
            ? `${reporter.first_name} ${reporter.middle_name || ''} ${reporter.last_name}`.trim()
            : "Unknown",
          reported_whom_name: violator
            ? `${violator.first_name} ${violator.middle_name || ''} ${violator.last_name}`.trim()
            : "Unknown",
          reason: report.reason || "No reason provided",
          status: report.status,
        };
      });

      console.log("Fetched report history for userId", userId, ":", formattedReports);
      return formattedReports;
    } catch (err) {
      console.error("Unexpected error in getReportHistory:", err);
      throw err;
    }
  }

  /**
   * Retrieves all taskers with their user details.
   * @returns Promise<TaskerWithUser[]> - Array of tasker objects with user details
   */
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

    // console.log("Mapped taskers:", taskers);

    return taskers;
  }

  /**
   * Retrieves all clients with their user details.
   * @returns Promise<ClientWithUser[]> - Array of client objects with user details
   */
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

  /**
   * Retrieves all reports with associated user details.
   * @returns Promise<any[]> - Array of report objects with user details and formatted dates
   */
  async getAllReports() {
    try {
      const { data: reports, error: reportError } = await supabase.from("report").select("*").order('report_id', { ascending: false });

      if (reportError) {
        console.error("Supabase error fetching reports:", reportError);
        throw new Error(reportError.message);
      }

      if (!reports || reports.length === 0) {
        return [];
      }

      // Get all moderator user_ids (action_by) and report_ids
      const moderatorReportPairs = reports
        .filter(r => r.action_by && r.report_id)
        .map(r => ({ user_id: r.action_by, report_id: r.report_id }));

      // Fetch all action_taken_by for these moderator/report pairs
      let actionReasonMap = new Map();
      if (moderatorReportPairs.length > 0) {
        const { data: actions, error: actionsError } = await supabase
          .from("action_taken_by")
          .select("user_id, report_id, action_reason, created_at")
          .in("report_id", moderatorReportPairs.map(p => p.report_id));

        if (actionsError) throw new Error(actionsError.message);

        // Map (user_id, report_id) to action_reason
        actions.forEach(action => {
          const key = `${action.user_id}_${action.report_id}`;
          // If multiple, pick the latest by created_at
          if (
            !actionReasonMap.has(key) ||
            new Date(action.created_at) > new Date(actionReasonMap.get(key).created_at)
          ) {
            actionReasonMap.set(key, action);
          }
        });
      }

      const userIds = [
        ...new Set([
          ...reports.map((report) => report.reported_by),
          ...reports.map((report) => report.reported_whom),
          ...reports.map((report) => report.action_by),
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

      const combinedData = reports.map((report) => {
        const actionBy = userMap.get(report.action_by) || {
          user_id: report.action_by,
          first_name: "Unknown",
          middle_name: "Unknown",
          last_name: "Unknown",
          user_role: "Unknown",
        };
        const key = `${report.action_by}_${report.report_id}`;
        const actionTaken = actionReasonMap.get(key);
        return {
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
          actionBy,
          action_reason: actionTaken ? actionTaken.action_reason : 'Empty',
        };
      });

      const formattedData = combinedData.map((report) => ({
        ...report,
        created_at: report.created_at
          ? new Date(report.created_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
          : "N/A",
        updated_at: report.updated_at
          ? new Date(report.updated_at).toLocaleString("en-US", { timeZone: "Asia/Manila" })
          : "N/A",
      }));

      console.log("Combined reports with formatted dates:", formattedData);
      return formattedData;
    } catch (err) {
      console.error("Unexpected error in getAllReports:", err);
      throw err;
    }
  }

  /**
   * Updates the status of a report.
   * @param reportId - ID of the report to update
   * @param status - New status of the report
   * @param actionBy - ID of the user performing the update
   * @returns Promise<any> - Updated report object
   */
  async updateReportStatus(reportId: number, status: boolean, actionBy: number) {
    const { data, error } = await supabase
      .from("report")
      .update({
        status,
        action_by: actionBy,
        updated_at: new Date().toISOString(),
      })
      .eq("report_id", reportId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error updating report status:", error);
      throw new Error(error.message);
    }

    return data;
  }

  async getReportById(reportId: number) {
    const { data: report, error } = await supabase
      .from('reports')
      .select(`
        *,
        action_by:action_by_id (
          user_id,
          first_name,
          middle_name,
          last_name,
          user_role
        )
      `)
      .eq('report_id', reportId)
      .single();

    if (error) throw new Error(error.message);
    return report;
  }
}

const reportModel = new ReportModel();
export default reportModel;