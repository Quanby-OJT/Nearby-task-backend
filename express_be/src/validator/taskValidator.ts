import {body} from 'express-validator'

export const rejectionValidation = [
    body("task_status").notEmpty().withMessage("Please enter your task status"),
    body("reason_for_rejection_or_cancellation").notEmpty().withMessage("Please enter the tasker ID"),
]