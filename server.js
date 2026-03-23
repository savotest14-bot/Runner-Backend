require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const connectDBAndSeed = require("./config/db");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const employeeRoutes = require("./routes/employee");
const contractRoutes = require("./routes/contract");
const companyAdminRoutes = require("./routes/companyAdmin");
const taskRoutes = require("./routes/task");
const planRoutes = require("./routes/plan");
const company = require("./models/company");
const User = require("./models/user");

const app = express();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3031"
    ],
    credentials: true,
  })
);


app.get("/", (req, res) => {
  res.send("Server is running....");
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/contract", contractRoutes);
app.use("/api/company-admin", companyAdminRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/plan", planRoutes)


/* ============================= SERVER ============================= */

const startServer = async () => {
  await connectDBAndSeed();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
