import {body} from "express-validator"

export const userValidation = [
    body("name").isEmpty().isString().withMessage("Please Enter a Valid Name."),
    body("email").isEmpty().isEmail().withMessage("Email is not Valid. Please Try Again."),
    body("password").isEmpty().isStrongPassword().withMessage("Your password must have at least: symbols, numbers, letters, and it must be unique.")
]

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