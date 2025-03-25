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
import clientRooutes from "./routes/clientRoutes"; 
import reportRoutes from "./routes/reportRoutes";
import cookieParser from "cookie-parser";

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

// Mount auth routes - These should be public


// Mount API routes - This contains both public and protected routes
app.use("/connect", server);

app.use("/connect", authRoutes);

// Mount other routes - These will be protected by the isAuthenticated middleware in their respective files

app.use("/connect", userAccountRoute);
app.use("/connect", userRoute);
app.use("/connect", taskRoutes);
app.use("/connect", likeRoutes);
app.use("/connect", userlogRoutes);
app.use("/connect", clientRooutes);
app.use("/connect", reportRoutes);

// Start server
const PORT = port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    "Click this to direct: http://localhost:" + PORT + "/connect"
  );
});
