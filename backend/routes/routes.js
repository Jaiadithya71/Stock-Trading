// backend/routes/routes.js - UPDATED
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");
const statusRoute = require("./statusRoute");
const currencyRoutes = require("./currencyRoutes");
const nseOptionRoutes = require("./nseOptionRoutes"); // NEW

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);
router.use(statusRoute);
router.use(currencyRoutes);
router.use(nseOptionRoutes); // NEW - No auth required

module.exports = router;