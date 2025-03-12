import {body} from "express-validator"

export const userValidation = [
    body("first_name")
        .notEmpty().withMessage("First name is required")
        .isString().withMessage("First name must be a string")
        .trim()
        .escape(),
    
    body("middle_name")
        .isString().withMessage("Middle name must be a string")
        .trim()
        .escape(),
    
    body("last_name")
        .notEmpty().withMessage("Last name is required")
        .isString().withMessage("Last name must be a string")
        .trim()
        .escape(),
    
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Please enter a valid email address")
        .normalizeEmail(),
    
    body("password")
        .notEmpty().withMessage("Please enter your password")
        .isStrongPassword({
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        }).withMessage("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one symbol")
];

export const taskerValidation = [
    body("bio").isEmpty().isString().withMessage("Please Enter a Valid Bio."),
    body("specialization").isString().withMessage("Please Enter Your Specialization."),
    body("skills").isEmpty().isString().withMessage("Please Enter Your Desired Skills."),
    body("wage").isEmpty().isNumeric().withMessage("Please Enter Your Desired Wage."),
    body("tesda_documents_link").isEmpty().isURL().withMessage("Please Enter a Valid URL."),
    body("social_media_links").isEmpty().isURL().withMessage("Please Enter a Valid URL.")
]

export const clientValidation = [
    body("preferences").isEmpty().isString().withMessage("Please Enter Your Preferences."),
    body("client_address").isEmpty().isString().withMessage("Please Enter Your Address."),
]