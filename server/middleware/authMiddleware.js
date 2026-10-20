/**
 * Operator Authentication Middleware
 */
import { validateSessionToken } from '../controllers/authController.js';

export function requireOperatorAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  const session = validateSessionToken(token);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Security clearance required. Please authenticate at /operator-gateway/.'
    });
  }

  req.operator = session;
  next();
}
