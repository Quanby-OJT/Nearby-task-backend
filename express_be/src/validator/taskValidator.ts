import {body} from 'express-validator'

export const validateTask = [
    body("task_title").notEmpty().withMessage("Please Enter Your Job Title").bail().isString().withMessage("Your Input Must be a Valid Job Title."),
    body("task_description").notEmpty().withMessage("Please Enter Your Job Description").bail().isString().withMessage("Your Input Must be a Valid Job Description."),
    body("location").notEmpty().withMessage("Please Enter Your Location").bail().isString().withMessage("Your Input Must be a Valid Location."),
    body("specialization").notEmpty().withMessage("Select Your Needed Tasker/s Specialization").bail().isString().withMessage("Your Input Must be a Valid Specialization."),
    body("contact_price").notEmpty().withMessage("Please Enter Your Contact Price").bail().isNumeric().withMessage("Your Input Must be a Valid Contact Price."),
    body("task_begin_date").notEmpty().withMessage("Please Enter Your Task Begin Date").bail().isDate().withMessage("Your Input Must be a Valid Task Begin Date."),
    body("num_of_days").notEmpty().withMessage("Please Enter Your Number of Days").bail().isNumeric().withMessage("Your Input Must be a Valid Number of Days."),
    body("urgency").notEmpty().withMessage("Please Select if Your Task is Urgent or Not."),
    body("duration").notEmpty().withMessage("Please Enter Your Duration"),
]