import {body} from "express-validator"

export const userValidation = [
    body("first_name").notEmpty().isString().withMessage("Please enter your first name"),
    body("last_name").notEmpty().isString().withMessage("Please enter your last name"),
        body("password")
        .notEmpty().withMessage("Please enter your password").bail()
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        }).withMessage("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one symbol"),
    body("user_role").notEmpty().isIn(['Client', 'Tasker']).withMessage("Invalid user role"),
    body("email")
        .notEmpty().withMessage("Email is required").bail()
        .isEmail().withMessage("Please enter a valid email address")
        .normalizeEmail(),
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