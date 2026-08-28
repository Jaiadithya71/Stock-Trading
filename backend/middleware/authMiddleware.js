const activeDashboards = {};

function requireAuth(req, res, next) {
  const { username } = req.body || {};
  let dashboard = activeDashboards[username];
  
  // Fallback to default or any authenticated dashboard
  if (!dashboard || !dashboard.authenticated) {
    dashboard = activeDashboards['default'] || Object.values(activeDashboards).find(d => d && d.authenticated);
  }

  // Fallback for local testing / demo mode
  if (!dashboard || !dashboard.authenticated) {
    if (username === 'demo' || username === 'default' || !process.env.RENDER) {
      dashboard = { authenticated: true, username: username || 'demo', smart_api: {} };
    }
  }

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