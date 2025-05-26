import path from "path";
import juice from "juice";
import ejs from "ejs";
import fs from "fs";


class renderEmail {
    static async renderEmailTemplate(name: string, otp: string): Promise<String> {
        try {
        const styles = fs.readFileSync(
        path.join(__dirname, '../../views/output.css'),
        'utf8'
        );

        const content = await ejs.renderFile(
        path.join(__dirname, '../../views/emails/templates/otp_email.ejs'),
        { name, otp }
        );

        const htmlWithLayout = await ejs.renderFile(
        path.join(__dirname, '../../views/emails/layouts/layout.ejs'),
        { styles, body: content }
        );

        const inlined = juice(htmlWithLayout);
        return inlined;
        
        } catch (error) {
            console.error("Error rendering email template:", error);
            return error instanceof Error ? error.message : "An unknown error occurred";
        }
    }
}
