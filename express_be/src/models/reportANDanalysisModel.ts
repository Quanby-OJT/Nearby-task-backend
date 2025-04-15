import { supabase } from "../config/configuration";

class ReportANDAnalysisModel {
  async getAllspecialization(trendType: 'requested' | 'applied' = 'applied', month?: string) {
    // Fetch tasks posted from post_task for Total Requested
    const { data: tasksPosted } = await supabase
      .from("post_task")
      .select("created_at, specialization");

    // Fetch taskers with their specialization for Total Applied
    const { data: taskers } = await supabase
      .from("tasker")
      .select("created_at, tasker_specialization!specialization_id(specialization)");

    // Map tasks posted for Total Requested, default to empty array if null
    const allTaskPostedData = (tasksPosted || []).map(task => ({
      specialization: task.specialization || 'Unknown',
      created_at: task.created_at
    }));

    // Map taskers for Total Applied, default to empty array if null
    const allTaskerData = (taskers || []).map(tasker => ({
      // Cast to unknown first, then to the correct type
      specialization: (tasker.tasker_specialization as unknown as { specialization: string } | null)?.specialization || 'Unknown',
      created_at: tasker.created_at
    }));

    // Filter data by month if specified, otherwise use all data
    const taskPostedData = month
      ? allTaskPostedData.filter(item => {
          const itemMonth = new Date(item.created_at).toLocaleString("default", { month: "short" });
          return itemMonth === month;
        })
      : allTaskPostedData;

    const taskerData = month
      ? allTaskerData.filter(item => {
          const itemMonth = new Date(item.created_at).toLocaleString("default", { month: "short" });
          return itemMonth === month;
        })
      : allTaskerData;

    // Count Total Requested (tasks posted) per specialization
    const requestedCount: { [key: string]: number } = {};
    taskPostedData.forEach(item => {
      const spec = item.specialization;
      requestedCount[spec] = (requestedCount[spec] || 0) + 1;
    });

    // Count Total Applied (taskers) per specialization
    const appliedCount: { [key: string]: number } = {};
    taskerData.forEach(item => {
      const spec = item.specialization;
      appliedCount[spec] = (appliedCount[spec] || 0) + 1;
    });

    // Combine counts into rankedSpecializations
    const specializationsSet = new Set([
      ...Object.keys(requestedCount),
      ...Object.keys(appliedCount)
    ]);

    const rankedSpecializations = Array.from(specializationsSet).map(spec => ({
      specialization: spec,
      total_requested: requestedCount[spec] || 0,
      total_applied: appliedCount[spec] || 0
    }));

    // Sort by total_requested (descending), then by specialization name (ascending) for ties
    rankedSpecializations.sort((a, b) => {
      if (b.total_requested !== a.total_requested) {
        return b.total_requested - a.total_requested;
      }
      return a.specialization.localeCompare(b.specialization);
    });

    // Group by month for trends (based on trendType, using all data for the graph)
    const monthlyTrends: { [key: string]: { [key: string]: number } } = {};
    const dataToUse = trendType === 'requested' ? allTaskPostedData : allTaskerData;

    dataToUse.forEach(item => {
      const spec = item.specialization;
      const date = new Date(item.created_at);
      const month = date.toLocaleString("default", { month: "short" });

      if (!monthlyTrends[spec]) {
        monthlyTrends[spec] = {
          Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
        };
      }
      if (monthlyTrends[spec][month] !== undefined) {
        monthlyTrends[spec][month] += 1;
      }
    });

    return { rankedSpecializations, monthlyTrends };
  }
}

const reportANDanalysisModel = new ReportANDAnalysisModel();
export default reportANDanalysisModel;