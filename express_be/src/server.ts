import express, { Application } from "express";
import cors from "cors";
import { port, session_key } from "./config/configuration";
import server from "./routes/apiRoutes";
import disputeRoute from "./routes/disputeRoutes";
import userAccountRoute from "./routes/userAccountRoutes";
import taskRoutes from "./routes/taskRoutes";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import session from "express-session";
import likeRoutes from "./routes/likeRoutes";
import userlogRoutes from "./routes/userlogRoutes";
import clientRooutes from "./routes/clientRoutes"; 
import reportRoutes from "./routes/reportRoutes";
import cookieParser from "cookie-parser";
import authorityAccountRoutes from "./routes/authorityAccountRoutes";
import reportANDanalysisRoute from "./routes/reportANDanalysisRoute";
import paymentRoutes from "./routes/paymentRoutes";
import TaskerModel from "./models/taskerModel";
dotenv.config();
const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser()); 
app.use(
  session({
    secret: session_key,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60,
      secure: false,
      httpOnly: true,
    },
  })
);

app.use("/connect", server);

app.use("/connect", authRoutes);
app.use("/connect", userAccountRoute);
app.use("/connect", disputeRoute);
app.use("/connect", taskRoutes);
app.use("/connect", likeRoutes);
app.use("/connect", userlogRoutes);
app.use("/connect", clientRooutes);
app.use("/connect", reportRoutes);
app.use("/connect", authorityAccountRoutes);
app.use("/connect", reportANDanalysisRoute);
app.use("/connect", paymentRoutes);

// Start server
const PORT = port || 5000;

// Server startup logic
async function startServer() {
  try {
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(
        "Click this to direct: http://localhost:5000/connect"
      );
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();