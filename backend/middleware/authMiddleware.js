const activeDashboards = {};

function requireAuth(req, res, next) {
  const { username } = req.body;
  const dashboard = activeDashboards[username];
  
  if (!dashboard || !dashboard.authenticated) {
    return res.status(401).json({ 
      success: false, 
      message: "Not authenticated" 
    });
  }
  
  req.dashboard = dashboard;
  next();
}

function getActiveDashboards() {
  return activeDashboards;
}

function setActiveDashboard(username, dashboard) {
  activeDashboards[username] = dashboard;
}

module.exports = {
  requireAuth,
  getActiveDashboards,
  setActiveDashboard
};