import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { Xendit } from "xendit-node";

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

export const session_key = process.env.SESSION_KEY as string;

export const port = process.env.PORT;

export const url = process.env.URL;

export const xenditClient = new Xendit({
  secretKey: process.env.XENDIT_API_KEY ?? '',
})

const authString = `${process.env.ESCROW_EMAIL}:${process.env.ESCROW_API}`;
export const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;