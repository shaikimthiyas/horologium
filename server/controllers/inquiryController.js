/**
 * Horologium Telemetry Transmissions Controller
 * Logs contact and geodesic inquiry messages into SQLite
 */
import { db } from '../db/database.js';

export function createTransmission(req, res) {
  const { name, sender, email, message, hp_station_token } = req.body || {};

  // Honeypot Bot Trap: If hidden honeypot token is populated, silently drop spam
  if (hp_station_token) {
    return res.status(201).json({
      success: true,
      message: 'Transmission successfully logged in Horologium registry.'
    });
  }

  const transmitter = (name || sender || '').trim();

  if (!transmitter || !email || !message) {
    return res.status(400).json({
      success: false,
      error: 'Identifier, email, and payload are required.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid return frequency (email format).'
    });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const stmt = db.prepare(`
      INSERT INTO transmissions (transmitter_name, return_frequency, payload, ip_address, status)
      VALUES (?, ?, ?, ?, 'acknowledged')
    `);
    const info = stmt.run(transmitter, email.trim(), message.trim(), ip.toString());

    return res.status(201).json({
      success: true,
      id: Number(info.lastInsertRowid),
      message: 'Transmission successfully logged in Horologium registry.'
    });
  } catch (err) {
    console.error('[InquiryController Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function getTransmissions(req, res) {
  try {
    const stmt = db.prepare('SELECT id, transmitter_name, return_frequency, payload, status, created_at FROM transmissions ORDER BY id DESC LIMIT 50');
    const records = stmt.all();
    return res.json({
      success: true,
      transmissions: records
    });
  } catch (err) {
    console.error('[InquiryController Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
