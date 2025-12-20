const express = require("express");
const bodyParser = require("body-parser");
const routes = require("./routes/routes");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(express.static("frontend"));

// Routes
app.use("/api", routes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Trading Dashboard API running on port ${PORT}`);
  console.log(`📊 Access the dashboard at http://localhost:${PORT}`);
});

module.exports = app;