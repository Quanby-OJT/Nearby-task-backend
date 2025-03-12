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
import userlogRoutes from "./routes/userlogRoutes";
dotenv.config();
const app: Application = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);

app.use(express.json());
app.use(
  session({
    secret:
      "4f5e3f8d9c8a7b6c5d4e3f2a1b0c9d8e7f6g5h4i3j2k1l0m9n8o7p6q5r4s3t2u1v0wxyz",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60,
      secure: false,
      httpOnly: true,
    },
  })
);

// Routes
app.use(
  "/connect",
  server,
  userAccountRoute,
  userRoute,
  taskRoutes,
  authRoutes,
  likeRoutes,
  userlogRoutes
);

// Start server
const PORT = port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Click this to direct: http://localhost:" + PORT + "/connect");
});
