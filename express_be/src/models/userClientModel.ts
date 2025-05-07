import { supabase } from "../config/configuration";


class UserWithTasksModel {
    user_id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    image_link: string | null;
    birthdate: string;
    acc_status: string;
    gender: string;
    email: string;
    contact: string;
    verified: boolean;
    user_role: string;
    created_at: string;
    updated_at: string | null;
    user_preference: {
      preference_id: number;
      user_id: number;
      latitude: number | null;
      longitude: number | null;
      distance: number;
      specialization: string;
      age_start: number;
      age_end: number;
      limit: boolean;
      user_address: string;
      preference_created_at: string;
      preference_updated_at: string | null;
      address: {
        address_id: string;
        user_id: number;
        barangay: string | null;
        city: string;
        province: string;
        postal_code: string | null;
        country: string | null;
        address_latitude: number;
        address_longitude: number;
        default: boolean;
        street: string | null;
        address_created_at: string;
        address_updated_at: string | null;
      } | null;
    } | null;
    clients: {
      client_id: number;
      post_task: {
        task_id: number;
        task_title: string;
        task_description: string;
        duration: number;
        proposed_price: number;
        urgent: boolean;
        remarks: string;
        task_begin_date: string;
        period: string;
        location: string;
        task_specialization: string;
        status: string;
        work_type: string;
        task_created_at: string;
        task_updated_at: string | null;
      }[];
    } | null;
  
    constructor(data: any) {
      this.user_id = data.user_id;
      this.first_name = data.first_name;
      this.middle_name = data.middle_name;
      this.last_name = data.last_name;
      this.image_link = data.image_link;
      this.birthdate = data.birthdate;
      this.acc_status = data.acc_status;
      this.gender = data.gender;
      this.email = data.email;
      this.contact = data.contact;
      this.verified = data.verified;
      this.user_role = data.user_role;
      this.created_at = data.created_at;
      this.updated_at = data.updated_at;
      this.user_preference = data.user_preference
        ? {
            preference_id: data.user_preference.preference_id,
            user_id: data.user_preference.user_id,
            latitude: data.user_preference.latitude,
            longitude: data.user_preference.longitude,
            distance: data.user_preference.distance,
            specialization: data.user_preference.specialization,
            age_start: data.user_preference.age_start,
            age_end: data.user_preference.age_end,
            limit: data.user_preference.limit,
            user_address: data.user_preference.user_address,
            preference_created_at: data.user_preference.preference_created_at,
            preference_updated_at: data.user_preference.preference_updated_at,
            address: data.user_preference.address
              ? {
                  address_id: data.user_preference.address.address_id,
                  user_id: data.user_preference.address.user_id,
                  barangay: data.user_preference.address.barangay,
                  city: data.user_preference.address.city,
                  province: data.user_preference.address.province,
                  postal_code: data.user_preference.address.postal_code,
                  country: data.user_preference.address.country,
                  address_latitude: data.user_preference.address.address_latitude,
                  address_longitude: data.user_preference.address.address_longitude,
                  default: data.user_preference.address.default,
                  street: data.user_preference.address.street,
                  address_created_at: data.user_preference.address.address_created_at,
                  address_updated_at: data.user_preference.address.address_updated_at,
                }
              : null,
          }
        : null;
      this.clients = data.clients
        ? {
            client_id: data.clients.client_id,
            post_task: data.clients.post_task
              ? data.clients.post_task.map((task: any) => ({
                  task_id: task.task_id,
                  task_title: task.task_title,
                  task_description: task.task_description,
                  duration: task.duration,
                  proposed_price: task.proposed_price,
                  urgent: task.urgent,
                  remarks: task.remarks,
                  task_begin_date: task.task_begin_date,
                  period: task.period,
                  location: task.location,
                  task_specialization: task.task_specialization,
                  status: task.status,
                  work_type: task.work_type,
                  task_created_at: task.task_created_at,
                  task_updated_at: task.task_updated_at,
                }))
              : [],
          }
        : null;
    }
  }


export default UserWithTasksModel;