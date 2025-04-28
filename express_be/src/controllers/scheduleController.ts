import {supabase} from "../config/configuration";
import {Request, Response} from "express";

class ScheduleController {
    static async scheduleTask(req: Request, res: Response): Promise<void> {
        const { tasker_id, schedule } = req.body;
        console.log(req.body);
    
        if (!tasker_id || !Array.isArray(schedule)) {
            res.status(400).json({ error: "tasker_id and schedule array are required" });
            return;
        }
    
        try {
            const insertData = schedule.map((item: any) => ({
                tasker_id,
                scheduled_date: item.scheduled_date,
                start_time: item.start_time, // Already in HH:MM format
                end_time: item.end_time,     // Already in HH:MM format
            }));
    
            const { data, error } = await supabase
                .from("tasker_available_schedule")
                .insert(insertData);
    
            if (error) {
                console.error(error.message);
                res.status(500).json({ error: "An Error Occurred while Scheduling the Task" });
                return;
            }
    
            res.status(200).json({ message: "Tasks have been Scheduled Successfully.", data });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "An Error Occurred while Scheduling the Task" });
        }
    }



    static async displaySchedules(req: Request, res: Response): Promise<any> {
       const { tasker_id } = req.params;

        try {
            const { data, error } = await supabase
            .from('tasker_available_schedule')
            .select('*')
            .eq('tasker_id', tasker_id);

            if (error) {
            console.error('Supabase error:', error.message);
            return res.status(500).json({ error: error.message });
            }

            res.status(200).json({message: "Schedules fetched successfully.", data: data});
        } catch (error) {
            console.error('Error fetching schedules:', error);
            res.status(500).json({ error: 'An error occurred while fetching schedules' });
        }
    }

    static async rescheduleTask(req: Request, res: Response): Promise<any> {
        const {tasker_id, scheduled_date, start_time, end_time} = req.body;
        console.log(req.body);

        const {data, error} = await supabase.from("tasker_available_schedule").update({
            scheduled_date,
            start_time: start_time,
            end_time: end_time,
        }).eq("tasker_id", tasker_id);

        if (error) {
            console.error(error.message);
            res.status(500).json({error: "An Error Occurred while Rescheduling the Task"});
            return;
        }

        res.status(200).json({message: "Task has been Rescheduled Successfully.", data: data});
    }
}

export default ScheduleController;