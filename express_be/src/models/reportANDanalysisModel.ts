import { supabase } from "../config/configuration";

// Compact type definitions
interface User { first_name: string | null; middle_name: string | null; last_name: string | null; }
interface Client { client_id: number; user_id: string; user: User | null; }
interface PaymentLog { payment_history_id: number; amount: number; created_at: string; client_id: number; clients: Client | null; }

class ReportANDAnalysisModel {
  // Helper to calculate monthly trends (supports sum or max aggregation)
  private calculateMonthlyTrends<T>(
    data: T[],
    getValue: (item: T) => number,
    getKey: (item: T) => string,
    getMonth: (item: T) => string,
    aggregationType: 'sum' | 'max' = 'sum' // Default to sum for backward compatibility
  ) {
    const trends: { [key: string]: { [month: string]: number } } = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(item => {
      const key = getKey(item);
      const month = getMonth(item);
      const value = getValue(item);
      if (!trends[key]) trends[key] = Object.fromEntries(months.map(m => [m, 0]));
      if (aggregationType === 'sum') {
        trends[key][month] += value; // Sum the values
      } else {
        trends[key][month] = Math.max(trends[key][month], value); // Take the maximum
      }

      // Ating Logs Check
      console.log("--------------START------------------");
      console.log("specialization: " + key);
      console.log("month: " + month);
      console.log("value: " + value);
      console.log("aggregationType: " + aggregationType);
      console.log("--------------END------------------");
    });

    return trends;
  }

  async getAllspecialization(trendType: 'requested' | 'applied' = 'applied', month?: string) {
    // Fetch data
    const { data: tasksPosted } = await supabase.from("post_task").select("created_at, specialization");
    const { data: taskers } = await supabase.from("tasker").select("created_at, tasker_specialization!specialization_id(specialization)");

    // Map data
    const allTaskPostedData = (tasksPosted || []).map(task => ({
      specialization: task.specialization || 'Unknown',
      created_at: task.created_at
    }));
    const allTaskerData = (taskers || []).map(tasker => ({
      specialization: (tasker.tasker_specialization as any)?.specialization || 'Unknown',
      created_at: tasker.created_at
    }));

    // Filter by month if specified
    const filterByMonth = (data: typeof allTaskPostedData, m?: string) =>
      m ? data.filter(item => new Date(item.created_at).toLocaleString("default", { month: "short" }) === m) : data;
    const taskPostedData = filterByMonth(allTaskPostedData, month);
    const taskerData = filterByMonth(allTaskerData, month);

    // Count occurrences
    const countBySpecialization = (data: typeof taskPostedData) =>
      data.reduce((acc, item) => {
        acc[item.specialization] = (acc[item.specialization] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

    const requestedCount = countBySpecialization(taskPostedData);
    const appliedCount = countBySpecialization(taskerData);

    // Combine and sort specializations
    const rankedSpecializations = Array.from(new Set([...Object.keys(requestedCount), ...Object.keys(appliedCount)]))
      .map(spec => ({
        specialization: spec,
        total_requested: requestedCount[spec] || 0,
        total_applied: appliedCount[spec] || 0
      }))
      .sort((a, b) => b.total_requested - a.total_requested || a.specialization.localeCompare(b.specialization));
    
    // Calculate monthly trends (use sum for counting occurrences)
    const dataToUse = trendType === 'requested' ? allTaskPostedData : allTaskerData;
    const monthlyTrends = this.calculateMonthlyTrends(
      dataToUse,
      () => 1,
      item => item.specialization,
      item => new Date(item.created_at).toLocaleString("default", { month: "short" }),
      'sum' // Explicitly use sum for counting
    );
    return { rankedSpecializations, monthlyTrends };
  }

  async getTopDepositors() {
    // Fetch payment logs with joins
    const { data: paymentLogs, error } = await supabase
      .from("payment_logs")
      .select(`
        payment_history_id,
        amount,
        created_at,
        client_id,
        clients!payment_logs_client_id_fkey (
          client_id,
          user_id,
          user!clients_user_id_fkey (
            first_name,
            middle_name,
            last_name
          )
        )
      `)
      .order('created_at', { ascending: true }) as { data: PaymentLog[] | null, error: any };

    if (error || !paymentLogs || paymentLogs.length === 0) {
      console.error("Error fetching payment logs or no data:", error);
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    // Process deposits by user and month
    const depositsByUserAndMonth: { [userId: string]: { [month: string]: { amount: number; userName: string } } } = {};
    paymentLogs.forEach(log => {
      const user = log.clients?.user || null;
      const userName = user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown" : "Unknown";
      const userId = log.client_id?.toString() || "Unknown";
      const month = new Date(log.created_at).toLocaleString("default", { month: "short" });

      if (!depositsByUserAndMonth[userId]) depositsByUserAndMonth[userId] = {};
      if (!depositsByUserAndMonth[userId][month] || depositsByUserAndMonth[userId][month].amount < log.amount) {
        depositsByUserAndMonth[userId][month] = { amount: log.amount, userName };
      }
    });

    // Flatten and sort ranked depositors
    const rankedDepositors = Object.entries(depositsByUserAndMonth)
      .flatMap(([userId, months]) =>
        Object.entries(months).map(([month, { amount, userName }]) => ({ userName, amount, month }))
      )
      .sort((a, b) => b.amount - a.amount);

    // Calculate monthly trends (use max for highest deposit)
    const monthlyTrends = this.calculateMonthlyTrends(
      paymentLogs,
      log => log.amount,
      log => {
        const user = log.clients?.user;
        return user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown" : "Unknown";
      },
      log => new Date(log.created_at).toLocaleString("default", { month: "short" }),
      'max'
    );
    return { rankedDepositors, monthlyTrends };
  }
}

const reportANDanalysisModel = new ReportANDAnalysisModel();
export default reportANDanalysisModel;