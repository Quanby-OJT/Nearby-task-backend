import { supabase } from "../config/configuration"

class UploadFile{
    static async uploadFile(fileName: string, file: Express.Multer.File, ){

        /**
         * Upload Files.
         */
        const { error } = await supabase.storage.from("documents").upload(fileName, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: true
        })
        if(error) throw new Error(error.message)

        /**
         * Retrieve files and return as String.
         */
        const {data} = await supabase.storage.from("documents").getPublicUrl(fileName)

        return data
    }

        // if (imageEvidence && Array.isArray(imageEvidence)) {
        //   for (const file of imageEvidence) {
        //     try {
        //       const fileName = `disputes/DISPUTE-${Date.now()}-${file.originalname}`;
        //       console.log(`Uploading file: ${fileName}`);
    
        //       const { error } = await supabase.storage.from("crud_bucket").upload(fileName, file.buffer, {
        //         contentType: file.mimetype,
        //         cacheControl: "3600",
        //         upsert: true,
        //       });
        //       if (error) throw new Error(`Failed to upload file: ${error.message}`);
    
        //       const { data: disputeProof } = await supabase.storage
        //         .from("crud_bucket")
        //         .getPublicUrl(fileName);
    
        //       console.log(`File uploaded successfully: ${disputeProof.publicUrl}`);
        //       imageProof.push(disputeProof.publicUrl);
        //     } catch (err: any) {
        //       console.error(`Image skipped: ${file.originalname}`, err.message);
        //       res.status(400).json({
        //         success: false,
        //         error: `Image upload failed for ${file.originalname}: ${err.message}`,
        //       });
        //       return;
        //     }
        //   }
    
        //   console.log("Image Proof URLs:", imageProof);
        //   await TaskAssignment.createDispute(user_id, taskTakenId, reason_for_dispute, dispute_details, imageProof);
        // } else {
        //   console.log("No image evidence provided, proceeding with text dispute.");
        //   await TaskAssignment.createDispute(user_id, taskTakenId, reason_for_dispute, dispute_details);
        // }
}

export default UploadFile