const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const routes = require("./routes/routes");

const app = express();

// Middleware
app.use(bodyParser.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));

// API Routes
app.use("/api", routes);

// Serve index.html for root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Trading Dashboard API running on port ${PORT}`);
  console.log(`📊 Access the dashboard at http://localhost:${PORT}`);
});

module.exports = app;