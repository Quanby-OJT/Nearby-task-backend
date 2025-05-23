import { supabase } from "../config/configuration";

// Compact type definitions
interface User { first_name: string | null; middle_name: string | null; last_name: string | null; }
interface Client { client_id: number; user_id: string; user: User | null; }
interface PaymentLog { payment_history_id: number; amount: number; created_at: string; user_id: string; user: { clients: Client | null; first_name: string | null; middle_name: string | null; last_name: string | null; } | null; }

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

    // Map data, excluding items without valid specialization
    const allTaskPostedData = (tasksPosted || []).filter(task => task.specialization).map(task => ({
      specialization: task.specialization,
      created_at: task.created_at
    }));
    const allTaskerData = (taskers || []).filter(tasker => (tasker.tasker_specialization as any)?.specialization).map(tasker => ({
      specialization: (tasker.tasker_specialization as any).specialization,
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
    const { data: paymentLogs, error } = await supabase
      .from("payment_logs")
      .select(`
        payment_history_id,
        amount,
        created_at,
        user_id,
        user!payment_logs_user_id_fkey (
          first_name,
          middle_name,
          last_name,
          clients!clients_user_id_fkey (
            client_id,
            user_id
          )
        )
      `)
      .order('created_at', { ascending: true }) as { data: PaymentLog[] | null, error: any };
  
    // Log the raw Supabase response for debugging
    console.log("Supabase Response for getTopDepositors:");
    console.log("Error:", error);
    console.log("Data (paymentLogs):", paymentLogs);
  
    if (error || !paymentLogs || paymentLogs.length === 0) {
      console.error("Error fetching payment logs or no data:", error);
      return { rankedDepositors: [], monthlyTrends: {} };
    }
  
    // Process deposits by user and month, keeping all deposits
    const depositsByUserAndMonth: { [userId: string]: { [month: string]: { amounts: number[], userName: string } } } = {};
    paymentLogs.forEach(log => {
      // Ensure we have a valid amount and created_at
      if (!log.amount || !log.created_at) {
        console.warn("Skipping payment log due to missing amount or created_at:", log);
        return;
      }
  
      const user = log.user || null;
      const userName = user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown User" : "Unknown User";
      const userId = log.user_id?.toString() || "UnknownID";
      const month = new Date(log.created_at).toLocaleString("default", { month: "short" });
  
      if (!depositsByUserAndMonth[userId]) {
        depositsByUserAndMonth[userId] = {};
      }
      if (!depositsByUserAndMonth[userId][month]) {
        depositsByUserAndMonth[userId][month] = { amounts: [], userName };
      }
      depositsByUserAndMonth[userId][month].amounts.push(log.amount);
  
      // Log each processed log for debugging
      console.log(`Processed Payment Log - UserID: ${userId}, UserName: ${userName}, Month: ${month}, Amount: ${log.amount}`);
    });
  
    // Log the intermediate data structure
    console.log("Deposits by User and Month:", depositsByUserAndMonth);
  
    // Flatten and sort ranked depositors, using the maximum deposit per month
    const rankedDepositors = Object.entries(depositsByUserAndMonth)
      .flatMap(([userId, months]) =>
        Object.entries(months).map(([month, { amounts, userName }]) => {
          const maxAmount = Math.max(...amounts);
          return { userName, amount: maxAmount, month };
        })
      )
      .sort((a, b) => b.amount - a.amount);
  
    // Log the final ranked depositors
    console.log("Ranked Depositors:", rankedDepositors);
  
    // Calculate monthly trends using the maximum deposit per month
    const monthlyTrends = this.calculateMonthlyTrends(
      paymentLogs,
      log => log.amount,
      log => {
        const user = log.user;
        return user ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown User" : "Unknown User";
      },
      log => new Date(log.created_at).toLocaleString("default", { month: "short" }),
      'max' // Use 'max' to track the highest deposit per month
    );
  
    // Log the monthly trends
    console.log("Monthly Trends:", monthlyTrends);
  
    return { rankedDepositors: rankedDepositors, monthlyTrends: monthlyTrends };
  }

  async getTopTasker() {
    // Fetch taskers with user details and specialization
    const { data: taskers, error: taskerError } = await supabase
      .from("tasker")
      .select(`
        tasker_id,
        specialization_id,
        user_id,
        rating,
        user!user_id (
          first_name,
          middle_name,
          last_name
        ),
        tasker_specialization!specialization_id (specialization)
      `);
    if (taskerError || !taskers) {
      console.error("Error fetching taskers:", taskerError);
      return { taskers: [] };
    }

    // Fetch task counts for each tasker from task_taken
    const { data: taskTaken, error: taskTakenError } = await supabase
      .from("task_taken")
      .select("tasker_id");

    if (taskTakenError || !taskTaken) {
      console.error("Error fetching task_taken:", taskTakenError);
      return { taskers: [] };
    }

    // Count tasks per tasker
    const taskCounts = taskTaken.reduce((acc: { [key: string]: number }, task: any) => {
      const taskerId = task.tasker_id;
      acc[taskerId] = (acc[taskerId] || 0) + 1;
      return acc;
    }, {});

    // Map taskers with their task counts
    const rankedTaskers = taskers.map((tasker: any) => {
      const user = tasker.user || {};
      const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown";
      return {
        userName: fullName,
        specialization: tasker.tasker_specialization?.specialization || "Unknown",
        taskCount: taskCounts[tasker.tasker_id] || 0,
        rating: tasker.rating || 0
      };
    }).sort((a: any, b: any) => b.taskCount - a.taskCount);

    return { taskers: rankedTaskers };
  }

  async getTopClient() {
    // Fetch clients with user details (including address and gender)
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select(`
        client_id,
        user_id,
        rating,
        client_address,
        user!user_id (
          first_name,
          middle_name,
          last_name,
          gender
        )
      `);

    if (clientError || !clients) {
      console.error("Error fetching clients:", clientError);
      return { clients: [] };
    }

    // Fetch task counts for each client from post_task
    const { data: postTasks, error: postTaskError } = await supabase
      .from("post_task")
      .select("client_id");

    if (postTaskError || !postTasks) {
      console.error("Error fetching post_task:", postTaskError);
      return { clients: [] };
    }

    // Count tasks per client
    const taskCounts = postTasks.reduce((acc: { [key: string]: number }, task: any) => {
      const clientId = task.client_id;
      acc[clientId] = (acc[clientId] || 0) + 1;
      return acc;
    }, {});

    // Map clients with their task counts
    const rankedClients = clients.map((client: any) => {
      const user = client.user || {};
      const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown";
      return {
        userName: fullName,
        address: client.client_address || "Unknown",
        taskCount: taskCounts[client.client_id] || 0,
        gender: user.gender || "Unknown",
        rating: client.rating || 0
      };
    }).sort((a: any, b: any) => b.taskCount - a.taskCount);

    return { clients: rankedClients };
  }
}

const reportANDanalysisModel = new ReportANDAnalysisModel();
export default reportANDanalysisModel;