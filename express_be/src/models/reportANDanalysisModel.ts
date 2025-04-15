import { supabase } from "../config/configuration";

// Interface for task data
interface TaskWithSpecialization {
  created_at: string;
  specialization: string;
}

// Interface for tasker data with specialization
interface TaskerWithSpecialization {
  created_at: string;
  tasker_specialization: {
    specialization: string;
  } | null;
}

class ReportANDAnalysisModel {
  async getAllspecialization(trendType: 'requested' | 'applied' = 'applied') {
    // Fetch tasks posted from post_task for Total Requested
    const { data: tasksPosted, error: tasksPostedError } = await supabase
      .from("post_task")
      .select("created_at, specialization")
      .returns<TaskWithSpecialization[]>();

    if (tasksPostedError) {
      console.error("Supabase error fetching tasks posted:", tasksPostedError);
      throw new Error(tasksPostedError.message);
    }

    if (!tasksPosted || tasksPosted.length === 0) {
      console.log("No tasks posted found.");
      return { rankedSpecializations: [], monthlyTrends: {} };
    }

    // Fetch taskers with their specialization for Total Applied
    const { data: taskers, error: taskersError } = await supabase
      .from("tasker")
      .select("created_at, tasker_specialization!specialization_id(specialization)")
      .returns<TaskerWithSpecialization[]>();

    if (taskersError) {
      console.error("Supabase error fetching taskers:", taskersError);
      throw new Error(taskersError.message);
    }

    // Map tasks posted for Total Requested
    const taskPostedData = tasksPosted.map(task => ({
      specialization: task.specialization || 'Unknown',
      created_at: task.created_at
    }));

    // Map taskers for Total Applied
    const taskerData = taskers.map(tasker => ({
      specialization: tasker.tasker_specialization?.specialization || 'Unknown',
      created_at: tasker.created_at
    }));

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

    // Group by month for trends (based on trendType)
    const monthlyTrends: { [key: string]: { [key: string]: number } } = {};
    const dataToUse = trendType === 'requested' ? taskPostedData : taskerData;

    dataToUse.forEach(item => {
      const spec = item.specialization;
      const date = new Date(item.created_at);
      const month = date.toLocaleString("default", { month: "short" });

      if (!monthlyTrends[spec]) {
        monthlyTrends[spec] = {
          Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0,
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