import {supabase} from "../config/configuration";
import {Request, Response} from "express";

class ScheduleController {
    static async scheduleTask(req: Request, res: Response): Promise<void> {
        const {tasker_id, from_date, to_date, start_time, end_time} = req.body;
        console.log(req.body);

        const {data, error} = await supabase.from("tasker_available_schedule").insert({
            tasker_id,
            from_date,
            to_date,
            start_time,
            end_time,
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
        const {tasker_id, from_date, to_date, start_time, end_time} = req.body;
        console.log(req.body);

        const {data, error} = await supabase.from("tasker_available_schedule").update({
            from_date,
            to_date,
            start_time,
            end_time,
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