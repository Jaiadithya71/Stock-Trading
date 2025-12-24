// backend/routes/routes.js - UPDATED
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");
const statusRoute = require("./statusRoute");

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);
router.use(statusRoute);

module.exports = router;