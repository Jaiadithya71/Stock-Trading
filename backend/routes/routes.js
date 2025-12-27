// backend/routes/routes.js - UPDATED WITH PCR
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");
const statusRoute = require("./statusRoute");
const currencyRoutes = require("./currencyRoutes");
const nseOptionRoutes = require("./nseOptionRoutes");
const pcrRoutes = require("./pcrRoutes"); // NEW

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);
router.use(statusRoute);
router.use(currencyRoutes);
router.use(nseOptionRoutes); // No auth required
router.use(pcrRoutes); // NEW - PCR data routes

module.exports = router;