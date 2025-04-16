import { supabase } from "../config/configuration";

// Define types for the nested query result
interface User {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
}

interface Client {
  client_id: number;
  user_id: string;
  user: User | null; // One-to-one relationship, so it's an object or null
}

interface PaymentLog {
  payment_history_id: number;
  amount: number;
  created_at: string;
  client_id: number;
  clients: Client | null; // One-to-one relationship, so it's an object or null
}

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

  async getTopDepositors() {
    // First, fetch payment logs without the join to verify data
    const { data: paymentLogsWithoutJoin, error: errorWithoutJoin } = await supabase
      .from("payment_logs")
      .select("payment_history_id, amount, created_at, client_id")
      .order('created_at', { ascending: true });

    console.log("Payment logs without join:", paymentLogsWithoutJoin);
    if (errorWithoutJoin) {
      console.error("Error fetching payment logs without join:", errorWithoutJoin);
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    // Fetch clients data to verify user_id mapping
    const clientIds = paymentLogsWithoutJoin ? [...new Set(paymentLogsWithoutJoin.map(log => log.client_id))] : [];
    const { data: clientsData, error: clientsError } = await supabase
      .from("clients")
      .select("client_id, user_id")
      .in("client_id", clientIds);

    console.log("Clients data:", clientsData);
    if (clientsError) {
      console.error("Error fetching clients data:", clientsError);
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    // Fetch user data separately to debug
    const userIds = clientsData ? [...new Set(clientsData.map(client => client.user_id).filter(id => id))] : [];
    const { data: userData, error: userError } = await supabase
      .from("user")
      .select("user_id, first_name, middle_name, last_name")
      .in("user_id", userIds);

    console.log("User data:", userData);
    if (userError) {
      console.error("Error fetching user data:", userError);
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    // Fetch payment logs with joins to clients and user
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

    // Log the result of the query
    console.log("Payment logs with join:", paymentLogs);
    if (error) {
      console.error("Error fetching payment logs with join:", error);
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    if (!paymentLogs || paymentLogs.length === 0) {
      console.log("No payment logs found - likely an RLS issue.");
      return { rankedDepositors: [], monthlyTrends: {} };
    }

    // Process the data to find the highest deposit per user per month
    const depositsByUserAndMonth: {
      [userId: string]: { [month: string]: { amount: number; userName: string } };
    } = {};

    paymentLogs.forEach(log => {
      // Extract user data from the nested clients.user
      const client = log.clients;
      console.log(`Client for payment_history_id ${log.payment_history_id}:`, client);

      const user = client?.user || null;
      console.log(`User for payment_history_id ${log.payment_history_id}:`, user);

      const userName = user
        ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown"
        : "Unknown";

      const userId = log.client_id?.toString() || "Unknown";
      const date = new Date(log.created_at);
      const month = date.toLocaleString("default", { month: "short" });

      // Log the processed data for debugging
      console.log("Processing log:", { payment_history_id: log.payment_history_id, userId, month, amount: log.amount, userName });

      if (!depositsByUserAndMonth[userId]) {
        depositsByUserAndMonth[userId] = {};
      }

      if (!depositsByUserAndMonth[userId][month] || depositsByUserAndMonth[userId][month].amount < log.amount) {
        depositsByUserAndMonth[userId][month] = {
          amount: log.amount,
          userName: userName,
        };
      }
    });

    // Log the final depositsByUserAndMonth for debugging
    console.log("Final depositsByUserAndMonth:", depositsByUserAndMonth);

    // Flatten the data for the table
    const rankedDepositors: { userName: string; amount: number; month: string }[] = [];
    Object.keys(depositsByUserAndMonth).forEach(userId => {
      Object.keys(depositsByUserAndMonth[userId]).forEach(month => {
        rankedDepositors.push({
          userName: depositsByUserAndMonth[userId][month].userName,
          amount: depositsByUserAndMonth[userId][month].amount,
          month,
        });
      });
    });

    // Sort by amount (descending)
    rankedDepositors.sort((a, b) => b.amount - a.amount);

    // Log the rankedDepositors for debugging
    console.log("rankedDepositors:", rankedDepositors);

    // Group by month for trends (total deposits per user per month for the graph)
    const monthlyTrends: { [userName: string]: { [month: string]: number } } = {};
    paymentLogs.forEach(log => {
      const client = log.clients;

      const user = client?.user || null;
      const userName = user
        ? [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ') || "Unknown"
        : "Unknown";

      const date = new Date(log.created_at);
      const month = date.toLocaleString("default", { month: "short" });

      if (!monthlyTrends[userName]) {
        monthlyTrends[userName] = {
          Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
        };
      }
      monthlyTrends[userName][month] += log.amount;
    });

    // Log the monthlyTrends for debugging
    console.log("monthlyTrends:", monthlyTrends);

    return { rankedDepositors, monthlyTrends };
  }
}

const reportANDanalysisModel = new ReportANDAnalysisModel();
export default reportANDanalysisModel;