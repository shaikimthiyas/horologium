/**
 * Horologium Operator Authentication Controller
 * Scoped, secure HMAC token-based clearance system
 */
import { db, verifyPassword, hashPassword } from '../db/database.js';
import { randomBytes, createHmac } from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'horologium_meridian_telemetry_2026';
const activeSessions = new Map();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function generateSessionToken(callsign) {
  const nonce = randomBytes(24).toString('hex');
  const signature = createHmac('sha256', SESSION_SECRET).update(`${callsign}:${nonce}`).digest('hex');
  return `${callsign}.${nonce}.${signature}`;
}

export function validateSessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [callsign, nonce, signature] = parts;
  const expectedSignature = createHmac('sha256', SESSION_SECRET).update(`${callsign}:${nonce}`).digest('hex');

  if (signature !== expectedSignature) return null;

  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

export function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Callsign and cipher are required.'
    });
  }

  const stmt = db.prepare('SELECT * FROM operators WHERE callsign = ?');
  const operator = stmt.get(username.trim().toLowerCase());

  if (!operator) {
    return res.status(401).json({
      success: false,
      error: 'Invalid operator callsign or access cipher.'
    });
  }

  const isValid = verifyPassword(password, operator.password_hash, operator.salt);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid operator callsign or access cipher.'
    });
  }

  const token = generateSessionToken(operator.callsign);
  const sessionData = {
    id: operator.id,
    callsign: operator.callsign,
    role: operator.role,
    expiresAt: Date.now() + SESSION_DURATION_MS
  };
  activeSessions.set(token, sessionData);

  // Log authentication event
  db.prepare('INSERT INTO telemetry_logs (event_type, details) VALUES (?, ?)').run(
    'AUTH_GRANTED',
    JSON.stringify({ callsign: operator.callsign, ip: req.ip })
  );

  return res.json({
    success: true,
    message: `Security clearance verified for operator ${operator.callsign.toUpperCase()}`,
    token,
    operator: {
      callsign: operator.callsign,
      role: operator.role
    }
  });
}

export function getMe(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = validateSessionToken(token);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'No active operator clearance session.'
    });
  }

  return res.json({
    success: true,
    operator: {
      callsign: session.callsign,
      role: session.role
    }
  });
}

export function logout(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  activeSessions.delete(token);

  return res.json({
    success: true,
    message: 'Operator clearance revoked.'
  });
}

export function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current cipher and new cipher are required.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'New cipher must contain at least 8 characters.'
    });
  }

  const callsign = req.operator?.callsign;
  if (!callsign) {
    return res.status(401).json({
      success: false,
      error: 'Active operator session required.'
    });
  }

  const stmt = db.prepare('SELECT * FROM operators WHERE callsign = ?');
  const operator = stmt.get(callsign);

  if (!operator) {
    return res.status(404).json({
      success: false,
      error: 'Operator account not found.'
    });
  }

  const isValid = verifyPassword(currentPassword, operator.password_hash, operator.salt);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Current access cipher is invalid.'
    });
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE operators SET password_hash = ?, salt = ? WHERE callsign = ?').run(hash, salt, callsign);

  db.prepare('INSERT INTO telemetry_logs (event_type, details) VALUES (?, ?)').run(
    'AUTH_PASSWORD_CHANGED',
    JSON.stringify({ callsign, ip: req.ip, timestamp: new Date().toISOString() })
  );

  return res.json({
    success: true,
    message: 'Operator cipher updated successfully.'
  });
}
