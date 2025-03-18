import {body} from "express-validator"

export const userValidation = [
    body("first_name").notEmpty().isString().withMessage("Please enter your first name"),
    body("last_name").notEmpty().isString().withMessage("Please enter your last name"),
    body("email").notEmpty().isEmail().withMessage("Please enter a valid email address"),
    body("password").notEmpty().isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
        .matches(/[A-Z]/).withMessage("Password must contain at least one uppercase letter")
        .matches(/[0-9]/).withMessage("Password must contain at least one number"),
    body("user_role").notEmpty().isIn(['Client', 'Tasker']).withMessage("Invalid user role")
]

export const taskerValidation = [
    body("bio").notEmpty().isString().withMessage("Please enter your bio"),
    body("specialization").notEmpty().isString().withMessage("Please enter your specialization"),
    body("skills").notEmpty().isString().withMessage("Please enter your skills"),
    body("wage").notEmpty().isNumeric().withMessage("Please enter a valid wage"),
    body("tesda_documents_link").optional().isURL().withMessage("Please enter a valid URL for TESDA documents"),
    body("social_media_links").optional().isURL().withMessage("Please enter a valid URL for social media")
]

export const clientValidation = [
    body("preferences").notEmpty().isString().withMessage("Please enter your preferences"),
    body("client_address").notEmpty().isString().withMessage("Please enter your address")
]