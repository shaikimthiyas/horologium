/**
 * Horologium Sovereign Countries & Geodesic Registry Controller
 * Provides standardized REST endpoints for querying all 220 sovereign entities,
 * capitals, coordinates, flags, and IANA timezone mappings.
 */

import { COUNTRIES_DATA } from '../../src/data/countries.data.js';

const countriesList = Object.entries(COUNTRIES_DATA).map(([countryName, info]) => ({
  name: countryName,
  code: info.code,
  capital: info.capital,
  tz: info.tz,
  utcOffset: info.utc,
  abbreviation: info.abbr,
  flag: info.flag
})).sort((a, b) => a.name.localeCompare(b.name));

export function getCountries(req, res) {
  const { query, tz, page = 1, limit = 50 } = req.query;

  let results = [...countriesList];

  if (query && typeof query === 'string') {
    const q = query.trim().toLowerCase();
    results = results.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.capital && c.capital.toLowerCase().includes(q)) ||
      (c.tz && c.tz.toLowerCase().includes(q)) ||
      (c.abbreviation && c.abbreviation.toLowerCase().includes(q))
    );
  }

  if (tz && typeof tz === 'string') {
    results = results.filter(c => c.tz.toLowerCase() === tz.trim().toLowerCase());
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(250, Math.max(1, parseInt(limit, 10) || 50));
  const startIndex = (parsedPage - 1) * parsedLimit;
  const endIndex = startIndex + parsedLimit;

  const paginatedData = results.slice(startIndex, endIndex);

  res.json({
    status: 'SUCCESS',
    totalRecords: results.length,
    page: parsedPage,
    pageSize: parsedLimit,
    totalPages: Math.ceil(results.length / parsedLimit),
    data: paginatedData
  });
}

export function getCountryByCode(req, res) {
  const code = (req.params.code || '').trim().toUpperCase();
  const country = countriesList.find(c => c.code === code || c.name.toUpperCase() === code);

  if (!country) {
    return res.status(404).json({
      status: 'NOT_FOUND',
      message: 'No sovereign territory found matching identifier: ' + req.params.code
    });
  }

  res.json({
    status: 'SUCCESS',
    data: country
  });
}
