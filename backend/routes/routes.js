// backend/routes/routes.js - UPDATED WITH OPTION ROUTES
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");
const statusRoute = require("./statusRoute");
const currencyRoutes = require("./currencyRoutes");
const optionRoutes = require("./optionRoutes");

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);
router.use(statusRoute);
router.use(currencyRoutes);
router.use(optionRoutes);

module.exports = router;