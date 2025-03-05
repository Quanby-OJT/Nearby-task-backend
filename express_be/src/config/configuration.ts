import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import crypto from 'crypto';

// Supabase Configuration
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_KEY as string
);

export const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST as string,
  port: parseInt(process.env.MAIL_PORT as string, 10),
  secure: process.env.MAIL_PORT === '465', // Set to `true` if using SSL (e.g., for port 465)
  auth: {
    user: process.env.MAIL_USERNAME as string,
    pass: process.env.MAIL_PASSWORD as string,
  },
} as SMTPTransport.Options);

export const session_key = crypto.randomUUID();

export const port = process.env.PORT;

export const url = process.env.URL;