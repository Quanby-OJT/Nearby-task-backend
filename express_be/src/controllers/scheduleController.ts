import {supabase} from "../config/configuration";
import {Request, Response} from "express";

class ScheduleController {
    static async scheduleTask(req: Request, res: Response): Promise<void> {
        const {tasker_id, scheduled_date, start_time, end_time} = req.body;
        console.log(req.body);

        const extractTime = (timeString: string): string => {
            const match = timeString.match(/TimeOfDay\((\d{2}:\d{2})\)/);
            return match ? match[1] : timeString;
        };

        const extractedStartTime = extractTime(start_time);
        const extractedEndTime = extractTime(end_time);

        const {data, error} = await supabase.from("tasker_available_schedule").insert({
            tasker_id,
            scheduled_date,
            start_time: extractedStartTime,
            end_time: extractedEndTime,
        });

        if (error) {
            console.error(error.message);
            res.status(500).json({error: "An Error Occurred while Scheduling the Task"});
            return;
        }

        res.status(200).json({message: "Task has been Scheduled Successfully.", data: data});
    }

    static async displaySchedules(req: Request, res: Response): Promise<void> {
        const {tasker_id} = req.params;
        console.log(req.params);

        const {data, error} = await supabase.from("tasker_available_schedule").select("*").eq("tasker_id", tasker_id);

        if (error) {
            console.error(error.message);
            res.status(500).json({error: "An Error Occurred while Fetching the Schedules"});
            return;
        }

        res.status(200).json({message: "Schedules fetched successfully.", data: data});
    }

    static async rescheduleTask(req: Request, res: Response): Promise<void> {
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