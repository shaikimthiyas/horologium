/**
 * Horologium Pinned Stations Controller
 * CRUD operations for custom telemetry stations stored with dual-engine support
 * and backward-compatible field harmonization (city/name, tz/timezone).
 */
import { db } from '../db/database.js';

export function getPins(req, res) {
  try {
    const stmt = db.prepare('SELECT id, city, country, tz, sort_order FROM pinned_stations ORDER BY sort_order ASC, id ASC');
    const rawPins = stmt.all();
    const pins = rawPins.map(p => ({
      id: p.id,
      city: p.city,
      name: p.city,
      country: p.country,
      tz: p.tz,
      timezone: p.tz,
      sort_order: p.sort_order
    }));

    return res.json({
      success: true,
      pins
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function addPin(req, res) {
  const body = req.body || {};
  const city = (body.city || body.name || '').trim();
  const tz = (body.tz || body.timezone || '').trim();
  const country = (body.country || 'Global Station').trim();
  const sort_order = parseInt(body.sort_order, 10) || 0;

  if (!city || !tz) {
    return res.status(400).json({
      success: false,
      error: 'Either ("city" and "tz") or ("name" and "timezone") must be provided.'
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO pinned_stations (city, country, tz, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(city, country, tz, sort_order);
    const newId = Number(info.lastInsertRowid);

    return res.status(201).json({
      success: true,
      id: newId,
      pin: {
        id: newId,
        city,
        name: city,
        country,
        tz,
        timezone: tz,
        sort_order
      },
      message: `Station ${city} pinned to horology matrix.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export function deletePin(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ success: false, error: 'Valid station ID required.' });
  }

  try {
    const stmt = db.prepare('DELETE FROM pinned_stations WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
      return res.status(404).json({ success: false, error: 'Pinned station not found.' });
    }

    return res.json({
      success: true,
      message: 'Station unpinned successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
