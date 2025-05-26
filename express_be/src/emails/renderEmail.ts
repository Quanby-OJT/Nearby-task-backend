import path from "path";
import juice from "juice";
import ejs from "ejs";
import fs from "fs";


class renderEmail {
    static async renderOTPEmail(name: string, otp: string): Promise<any> {
        try {
            const content = await ejs.renderFile(
            path.join(__dirname, '/src/templates/otp_email.ejs'),
            { name, otp }
            );

            const html = await this.generateLayout(content)

            console.log(html)

            const inlined = juice(html);
            return html
        
        } catch (error) {
            console.error("Error rendering email template:", error);
            return {error: 'An error occured while rendering the email. Please try again.'};
        }
    }

    static async depositQTaskAmountEmail(name: string,){

    }

    //To render all email.  
    static async generateLayout(content: string) {
        try{
            const styles = fs.readFileSync(
                path.join(__dirname, '/src/css/output.email.css'),
                'utf8'
            );


            const htmlWithLayout = await ejs.renderFile(
                path.join(__dirname, '/src/layouts/layouts.ejs'),
                { styles: styles, title: "Your QTask OTP", body: content }
            );

            return htmlWithLayout
        }catch(error){
            console.error("Error building email template:", error);
            throw new Error("An error occured while structuring your email. Please Try Again.")
        }
    }
}

export default renderEmail;
