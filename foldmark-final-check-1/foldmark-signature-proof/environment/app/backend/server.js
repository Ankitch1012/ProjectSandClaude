'use strict';

const http = require('http');
const {
  getJob,
  previewJob,
  releaseJob,
  resetJob,
  saveJob
} = require('./lib/job-store');

const PORT = Number(process.env.PORT || 5000);

function headers(contentType = 'application/json; charset=utf-8') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, If-Match',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Cache-Control': 'no-store',
    'Content-Type': contentType
  };
}

function send(res, status, payload) {
  res.writeHead(status, headers());
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers());
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && path === '/api/health') {
      send(res, 200, { ok: true, service: 'foldmark-proof' });
      return;
    }

    if (req.method === 'POST' && path === '/api/test/reset') {
      send(res, 200, resetJob());
      return;
    }

    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = getJob(decodeURIComponent(jobMatch[1]));
      send(res, job ? 200 : 404, job || { error: 'Print job not found.' });
      return;
    }

    const previewMatch = path.match(/^\/api\/jobs\/([^/]+)\/preview$/);
    if (req.method === 'POST' && previewMatch) {
      const body = await readJson(req);
      const preview = previewJob(decodeURIComponent(previewMatch[1]), body.state);
      send(res, preview ? 200 : 404, preview || { error: 'Print job not found.' });
      return;
    }

    if (req.method === 'PUT' && jobMatch) {
      const body = await readJson(req);
      const result = saveJob(decodeURIComponent(jobMatch[1]), body);
      send(res, result.status, result.body);
      return;
    }

    const releaseMatch = path.match(/^\/api\/jobs\/([^/]+)\/release$/);
    if (req.method === 'POST' && releaseMatch) {
      const body = await readJson(req);
      const result = releaseJob(decodeURIComponent(releaseMatch[1]), body);
      send(res, result.status, result.body);
      return;
    }

    send(res, 404, { error: 'Route not found.' });
  } catch (error) {
    send(res, 400, { error: error.message || 'Request failed.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FoldMark backend listening on ${PORT}`);
});
