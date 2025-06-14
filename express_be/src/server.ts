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
import ConversationRoutes from "./routes/conversationRoutes";
import fs from 'fs';
import https from "https";
import path from 'path'
import { Server } from "socket.io";
dotenv.config();
const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "Access-Control-Allow-Credentials"],
  })
);

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, process.env.SECURITY_KEY || 'mkcert+4-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, process.env.SECURITY_CERT || 'mkcert+4.pem')),
};

const httpsServer = https.createServer(sslOptions, app);
const io = new Server(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "Access-Control-Allow-Credentials"],
    credentials: true
  }
});

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
app.use("/connect", ConversationRoutes);
app.use("/connect", likeRoutes);
app.use("/connect", userlogRoutes);
app.use("/connect", clientRooutes);
app.use("/connect", reportRoutes);
app.use("/connect", authorityAccountRoutes);
app.use("/connect", reportANDanalysisRoute);
app.use("/connect", paymentRoutes);

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });

  socket.on("send_message", (data) => {
    io.emit("new_message", data);
  });

  socket.on("mark_as_read", (data) => {
    io.emit("message_read", data);
  });
});

const PORT = port || 5000;
httpsServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Click this to direct: ${process.env.URL}`);
});
