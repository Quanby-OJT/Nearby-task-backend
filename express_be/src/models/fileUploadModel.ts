import { DateTime } from "luxon";
import { supabase } from "../config/configuration"

class ManageFiles{
    /**
     * you can add here name of bucket if you have multiple buckets.
     * @param fileName 
     * @param file 
     * @returns id
     */
    static async uploadFile(fileName: string, file: Express.Multer.File) {
        try {
            console.log(file)

            /**
             * Upload Files.
             */
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("documents")
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: "3600",
                    upsert: true
                });

            console.log("Uploaded Items: ", uploadData, "Upload Error: ", uploadError)
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

    static async deleteFile(image_link: string[]){
        const { error } = await supabase.storage.from("documents").remove(image_link)
        if(error) throw new Error("Error in Deleting files: " + error.message)
    }

    static async deleteFileUrl(id: number, supabaseTable: string){
        if(!id) throw new Error("Unable to Delete Tasker Image.")
        const {error} = await supabase.from(supabaseTable).delete().eq("id", id)
        if(error) throw new Error(error.message)
    }

    static async createDocument(user_id: number, fileUrls: string, supabaseTable: string){
        interface DocumentUrls {
            id: number;
        }
        type DocumentUrlsResponse = {
            data: DocumentUrls[] | null;
            error: Error | null;
        }
        const {error: createDocumentError} = await supabase.from(supabaseTable).insert({
            user_id: user_id,
            image_link: fileUrls
        })

        if (createDocumentError) {
            if (createDocumentError.code === "PGRST116") {
                return null;
            }

            throw new Error(createDocumentError.message)
        }
        const {data: userDocuments, error: userDocumentsError} = await supabase.from(supabaseTable)
            .select('id')
            .eq('user_id', user_id) as DocumentUrlsResponse

        if (userDocumentsError) throw new Error(userDocumentsError.message);

        return userDocuments
    }

    
    static async createTaskerDocument(user_id: number, fileUrls: string){
        interface DocumentUrls {
            id: number;
        }
        type DocumentUrlsResponse = {
            data: DocumentUrls[] | null;
            error: Error | null;
        }
        const {error: createDocumentError} = await supabase.from("user_documents").insert({
            user_id: user_id,
            user_document_link: fileUrls,
            document_type: "TESDA Document"
        })

        if (createDocumentError) throw new Error(createDocumentError.message)
        // const {data: userDocuments, error: userDocumentsError} = await supabase.from(supabaseTable)
        //     .select('id')
        //     .eq('user_id', user_id) as DocumentUrlsResponse

        // if (userDocumentsError) throw new Error(userDocumentsError.message);

        // return userDocuments
    }

    static async getDocumentForUser(user_id: number, supabaseTable: string){
        interface DocumentInfo {
            data: {
                id: number;
                image_link: string;
                created_at: DateTime;
                updated_at: DateTime;
            }[] | null,
            error: any
        }
        const {data, error} = await supabase.from(supabaseTable).select("id, image_link, created_at, updated_at").eq("user_id", user_id) as DocumentInfo

        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw new Error(error.message);
        }

        return data
    }

        static async getDocument(id: number, supabaseTable: string){

        const {data, error} = await supabase.from(supabaseTable).select("id, image_link, created_at, updated_at").eq("id", id).single()

        if (error) {
            if (error.code === "PGRST116") {
                return null;
            }
            throw new Error(error.message);
        }

        return data
    }

    static async updateDocument(user_id: number, document_id: number, fileUrls: string, supabaseTable: string){
        const {error: updateDocumentError} = await supabase.from(supabaseTable).update({
            image_link: fileUrls
        }).eq("user_id", user_id).eq("id", document_id)

        if (updateDocumentError) {
            if (updateDocumentError.code === "PGRST116") {
                return null;
            }
            throw new Error(updateDocumentError.message);
        }

        // Get all document IDs for this user
        const {data: userDocuments, error: userDocumentsError} = await supabase.from(supabaseTable)
            .select('id')
            .eq('user_id', user_id)

        if (userDocumentsError) throw new Error(userDocumentsError.message)

        return userDocuments
    }
}

export default ManageFiles