import { supabase } from "../config/configuration";

class UserLogModel {
  static async getLogs() {
    const { data, error } = await supabase
      .from("user_logs")
      .select(`
        log_id, 
        logged_in, 
        logged_out, 
        session, 
        user:user_id (
          first_name, 
          middle_name, 
          last_name,
          status,
          user_role
        )
      `)
      .order('log_id  ', { ascending: false });
  
    if (error) {
      throw error;
    }
  
    return data.map((log: any) => ({
      ...log,
      logged_in: log.logged_in ? new Date(log.logged_in).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
      logged_out: log.logged_out ? new Date(log.logged_out).toLocaleString("en-US", { timeZone: "Asia/Manila" }) : null,
    }));
  }
}

export default UserLogModel;
