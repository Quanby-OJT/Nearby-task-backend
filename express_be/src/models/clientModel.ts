import {supabase} from "../config/configuration"

class ClientModel{
    static async createNewClient(clientInfo: {user_id: number, preferences: Text, client_address: Text}){
        const {data, error} = await supabase
            .from('clients')
            .insert([clientInfo])
        if(error) throw new Error(error.message)
        
        return data
    }

    static async getAllClients(){
        const {data, error} = await supabase.from('clients').select('*')
        if(error) throw new Error(error.message)
        
        return data
    }

    static async updateClient(clientId: number, clientInfo: {user_id: number, preferences: Text, client_address: Text}){
        const {data, error} = await supabase.from('clients').update(clientInfo).eq('id', clientId)
        if(error) throw new Error(error.message)
        return data
    }

    static async archiveCLient(clientId: number){
        const {data, error} = await supabase.from('clients').update({acc_status: 'blocked'}).eq('id', clientId)
        if(error) throw new Error(error.message)
        return data
    }
}

export default ClientModel