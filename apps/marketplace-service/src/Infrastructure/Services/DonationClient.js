const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * HTTP client for donation-service inventory APIs.
 */
class DonationClient {
  constructor(baseUrl) {
    this.baseUrl = (baseUrl || process.env.DONATION_SERVICE_URL || 'http://donation-service:3003').replace(/\/$/, '');
    this.soft = process.env.MARKETPLACE_SOFT_CHECKS === 'true';
  }

  async _request(method, path, { token, body } = {}) {
    const url = new URL(path, this.baseUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          timeout: 8000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = data ? JSON.parse(data) : null;
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode, data: parsed });
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Donation request timeout'));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  _unwrap(data) {
    if (data && typeof data === 'object' && data.data !== undefined) return data.data;
    return data;
  }

  async getInventoryItem(itemId, token) {
    try {
      const { status, data } = await this._request('GET', `/internal/inventory/${itemId}`, { token });
      if (status === 404) return null;
      if (status >= 400) {
        if (this.soft) return { id: itemId, status: 'in_stock' };
        throw new Error(`Donation get inventory failed: ${status}`);
      }
      return this._unwrap(data);
    } catch (err) {
      console.warn('DonationClient.getInventoryItem:', err.message);
      if (this.soft) return { id: itemId, status: 'in_stock' };
      throw err;
    }
  }

  async updateItemStatus(itemId, status, ref = {}, token) {
    try {
      const body = {
        status,
        refType: ref.refType || ref.ref_type || null,
        refId: ref.refId || ref.ref_id || null,
        note: ref.note || null,
      };
      const res = await this._request('PUT', `/internal/inventory/${itemId}/status`, { token, body });
      if (res.status >= 400) {
        if (this.soft) return { id: itemId, status };
        throw new Error(`Donation update status failed: ${res.status}`);
      }
      return this._unwrap(res.data);
    } catch (err) {
      console.warn('DonationClient.updateItemStatus:', err.message);
      if (this.soft) return { id: itemId, status };
      throw err;
    }
  }
}

module.exports = DonationClient;
