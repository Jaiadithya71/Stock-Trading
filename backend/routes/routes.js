// backend/routes/routes.js
const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");
const dataCheckRoutes = require("./dataCheckRoutes");

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);
router.use(dataCheckRoutes);

module.exports = router;