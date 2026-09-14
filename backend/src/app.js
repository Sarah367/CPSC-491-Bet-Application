const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const protectedRoutes = require("./routes/protectedRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/protected", protectedRoutes);

module.exports = app;