// middleware/auth.js
function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login?error=Please+log+in+to+continue');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login?error=Please+log+in');
  }
  if (req.session.role !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admins only.', user: req.session });
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login?error=Please+log+in');
  }
  if (req.session.role !== 'student') {
    return res.redirect('/admin/dashboard');
  }
  next();
}

module.exports = { requireLogin, requireAdmin, requireStudent };
