const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const betRoutes = require("./routes/betRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/protected", protectedRoutes);
// Must come after every route, so Express passes errors (like a malformed JSON body) to it.
app.use(errorHandler);
app.use("/api/bets", betRoutes);

module.exports = app;