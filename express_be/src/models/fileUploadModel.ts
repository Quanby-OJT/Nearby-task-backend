import { supabase } from "../config/configuration"

class UploadFile{
    static async uploadFile(fileName: string, file: Express.Multer.File) {
        try {
            /**
             * Upload Files.
             */
            const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(fileName, file.buffer, {
                contentType: file.mimetype,
                cacheControl: "3600",
                upsert: true
            });

            console.log()
            if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);


            /**
             * Retrieve files and return as String.
             */
            const { data: publicUrlData } = await supabase.storage.from("documents").getPublicUrl(fileName);
            if (!publicUrlData) throw new Error('Failed to get public URL');

            return publicUrlData;
        } catch (err: any) {
            console.error('Upload file error:', err.message);
            throw err;
        }
    }
}

export default UploadFile