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

// Interface for tasker with specialization
interface TaskerWithSpecialization {
  created_at: string;
  tasker_specialization: {
    specialization: string;
  };
}

class ReportANDAnalysisModel {
  async getAllspecialization() {
    // Fetch taskers with their specialization and created_at
    const { data: taskers, error } = await supabase
      .from("tasker")
      .select("created_at, tasker_specialization!specialization_id(specialization)")
      .returns<TaskerWithSpecialization[]>();

    if (error) {
      console.error("Supabase error fetching taskers:", error);
      throw new Error(error.message);
    }

    if (!taskers || taskers.length === 0) {
      return { rankedSpecializations: [], monthlyTrends: {} };
    }

    // Map the data to a simpler structure with null safety
    const taskerData = taskers.map(tasker => ({
      specialization: tasker.tasker_specialization?.specialization || 'Unknown',
      created_at: tasker.created_at
    }));

    // Count occurrences of each specialization
    const specializationCount: { [key: string]: number } = {};
    taskerData.forEach(item => {
      const spec = item.specialization;
      specializationCount[spec] = (specializationCount[spec] || 0) + 1;
    });

    // Rank specializations by count (descending order)
    const rankedSpecializations = Object.entries(specializationCount)
      .map(([specialization, count]) => ({ specialization, count }))
      .sort((a, b) => b.count - a.count);

    // Group by month for trends (using created_at from tasker)
    const monthlyTrends: { [key: string]: { [key: string]: number } } = {};
    taskerData.forEach(item => {
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

  async getAlltasker() {
    const { data: tasker, error: taskerError } = await supabase
      .from("tasker")
      .select("*");

    if (taskerError) {
      console.error("Supabase error fetching reports:", taskerError);
      throw new Error(taskerError.message);
    }

    if (!tasker || tasker.length === 0) {
      return [];
    }
  }
}

const reportANDanalysisModel = new ReportANDAnalysisModel();
export default reportANDanalysisModel;