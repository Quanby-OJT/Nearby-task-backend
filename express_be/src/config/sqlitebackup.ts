import NodeCache from "node-cache"
import sqlite3 from "sqlite3";
import { supabase } from "../config/configuration"
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3"

/**
 * The reason why I put this code is to continue the use of the application in case supabase is down. We will use sqlite3 for this one.
 * 
 * -Ces
 */

export const sqliteDb = new sqlite3.Database('fallback.db', (err) => {
  if (err) console.error("SQLite connection error:", err);
  else console.log("Connected to SQLite fallback database");
});

//Store DB Sessions
const SQLiteStore = SQLiteStoreFactory(session)
export const sessionStore = new SQLiteStore({db: 'sessions.db'})

export const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

//Creating new tables
sqliteDb.serialize(() => {
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS client (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasker (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS conversation_history (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS likes (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS moderation_logs (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS saved_tasker (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS task_reviews (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasker_available_schedule (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasker_documents (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasker_specialization (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS two_fa_code (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS user_logs (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    data TEXT
  )`)
})



/**
 * This is to check if the supabase is online or offline. If it is offline, we will use sqlite3.
 * @returns 
 */
export async function checkSupabaseStatus(): Promise<boolean> {
  try {
    const { error } = await supabase.from("user").select("*").limit(1)
    if (error) throw error
    return true
  } catch(err) {
    console.error("Supabase is Currently Offline. Using sqlite3...", err)

    return false
  }
}

/**
 * If supabase had gone offline unexpectedly, it will first cache the data and be inserted to sqlite3.
 * @param key 
 * @param fetchFn 
 * @returns 
 */
export async function cacheData(key: string, fetchFn: () => Promise<any>): Promise<any> {
  const isSupabaseOnline = await checkSupabaseStatus()

  if (isSupabaseOnline) {
    const { data, error } = await fetchFn()
    if (error) throw error

    cache.set(key, data)
    return data
  } else {
    const cachedData = cache.get(key)
    if (cachedData){ 
      console.log(`Serving ${key} from cache`)
      return cachedData
    }

    throw new Error("Supabase is offline and no cache found.")
  }
}

export async function syncToSQLite() {
  const isSupabaseOnline = await checkSupabaseStatus()

  if (isSupabaseOnline) {
    //All tables from Supabase to be migrated to Sqlite

    const { data: user } = await supabase.from("user").select("*")
    const { data: clients } = await supabase.from("clients").select("*")
    const { data: tasker } = await supabase.from("tasker").select("*")
    const { data: activity_logs } = await supabase.from("activity_logs").select("*")
    const { data: conversation_history } = await supabase.from("conversation_history").select("*")
    const { data: likes } = await supabase.from("likes").select("*")
    const { data: moderation_logs } = await supabase.from("moderation_logs").select("*")
    const { data: saved_tasker } = await supabase.from("saved_tasker").select("*")
    const { data: task_reviews } = await supabase.from("task_reviews").select("*")
    const { data: tasker_available_schedule } = await supabase.from("tasker_available_schedule").select("*")
    const { data: tasker_documents } = await supabase.from("tasker_documents").select("*")
    const { data: tasker_specialization } = await supabase.from("tasker_specialization").select("*")
    const { data: tasks } = await supabase.from("tasks").select("*")

    //Insert all data from supabase to sqlite temporarily
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM user")
      user?.forEach(async (user) => {
      sqliteDb.run(`INSERT INTO user(id, data) VALUES (?, ?)`, [user.id, JSON.stringify(user)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM client")
      user?.forEach(async (user) => {
      sqliteDb.run(`INSERT INTO client(id, data) VALUES (?, ?)`, [user.id, JSON.stringify(user)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM tasker")
      user?.forEach(async (user) => {
      sqliteDb.run(`INSERT INTO tasker(id, data) VALUES (?, ?)`, [user.id, JSON.stringify(user)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM activity_logs")
      activity_logs?.forEach(async (activity_log) => {
      sqliteDb.run(`INSERT INTO activity_logs(id, data) VALUES (?, ?)`, [activity_log.id, JSON.stringify(activity_log)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM conversation_history")
      conversation_history?.forEach(async (conversation) => {
      sqliteDb.run(`INSERT INTO conversation_history(id, data) VALUES (?, ?)`, [conversation.id, JSON.stringify(conversation)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM likes")
      likes?.forEach(async (like) => {
      sqliteDb.run(`INSERT INTO likes(id, data) VALUES (?, ?)`, [like.id, JSON.stringify(like)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM moderation_logs")
      moderation_logs?.forEach(async (moderation_log) => {
      sqliteDb.run(`INSERT INTO moderation_logs(id, data) VALUES (?, ?)`, [moderation_log.id, JSON.stringify(moderation_log)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM saved_tasker")
      saved_tasker?.forEach(async (saved) => {
      sqliteDb.run(`INSERT INTO saved_tasker(id, data) VALUES (?, ?)`, [saved.id, JSON.stringify(saved)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM task_reviews")
      task_reviews?.forEach(async (task_review) => {
      sqliteDb.run(`INSERT INTO task_reviews(id, data) VALUES (?, ?)`, [task_review.id, JSON.stringify(task_review)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM tasker_available_schedule")
      tasker_available_schedule?.forEach(async (tasker_schedule) => {
      sqliteDb.run(`INSERT INTO tasker_available_schedule(id, data) VALUES (?, ?)`, [tasker_schedule.id, JSON.stringify(tasker_schedule)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM tasker_documents")
      tasker_documents?.forEach(async (tasker_document) => {
      sqliteDb.run(`INSERT INTO tasker_documents(id, data) VALUES (?, ?)`, [tasker_document.id, JSON.stringify(tasker_document)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM tasker_specialization")
      tasker_specialization?.forEach(async (tasker_special) => {
      sqliteDb.run(`INSERT INTO tasker_specialization(id, data) VALUES (?, ?)`, [tasker_special.id, JSON.stringify(tasker_special)])
      })
    })
    sqliteDb.serialize(() => {    
      sqliteDb.run("DELETE FROM tasks")
      tasks?.forEach(async (task) => {
      sqliteDb.run(`INSERT INTO tasks(id, data) VALUES (?, ?)`, [task.id, JSON.stringify(task)])
      })
    })
  }
}

interface SQLiteRow {
  data: string;
  id: string;
}

export async function getFromFallback(table: string): Promise<any> {
  return new Promise((resolve, reject) => {
    sqliteDb.all(`SELECT * FROM ${table}`, (err, rows: SQLiteRow[]) => {
      if (err) reject(err)
      resolve(rows.map(row => JSON.parse(row.data)))
    })
  })
}

setInterval(syncToSQLite, 5 * 60 * 1000) // Sync every minute