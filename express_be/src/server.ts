import express, { Application } from "express";
import cors from "cors";
import { port, session_key } from "./config/configuration";
import server from "./routes/apiRoutes";
import userRoute from "./routes/userRoutes";
import userAccountRoute from "./routes/userAccountRoutes";
import taskRoutes from "./routes/taskRoutes";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import session from "express-session";
import likeRoutes from "./routes/likeRoutes";

dotenv.config();
const app: Application = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json());
app.use(session({ 
  secret: session_key,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
    secure: false,
    httpOnly: true
  }
}));

// Routes
app.use(
  "/connect",
  server,
  userAccountRoute,
  userRoute,
  taskRoutes,
  authRoutes,
  likeRoutes
);

// Start server
const PORT = port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Click this to direct: http://localhost:" + PORT + "/connect");
});
