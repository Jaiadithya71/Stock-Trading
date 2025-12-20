const express = require("express");
const router = express.Router();
const authRoutes = require("./authRoutes");
const dataRoutes = require("./dataRoutes");

// Mount routes
router.use(authRoutes);
router.use(dataRoutes);

module.exports = router;