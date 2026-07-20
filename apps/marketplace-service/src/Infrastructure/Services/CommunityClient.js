const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * HTTP client for community-service (membership / moderator checks).
 */
class CommunityClient {
  constructor(baseUrl) {
    this.baseUrl = (baseUrl || process.env.COMMUNITY_SERVICE_URL || 'http://community-service:3002').replace(/\/$/, '');
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
        reject(new Error('Community request timeout'));
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  async verifyMembership(userId, groupId, token) {
    try {
      const { status, data } = await this._request(
        'GET',
        `/groups/${groupId}/members?status=approved&limit=100`,
        { token }
      );
      if (status >= 400) {
        if (this.soft) return { approved: true, role: null };
        return { approved: false, role: null };
      }
      const items = (data && data.data && data.data.items) || (data && data.items) || [];
      const member = items.find((m) => String(m.user_id) === String(userId));
      if (!member) return { approved: false, role: null };
      return { approved: true, role: member.role };
    } catch (err) {
      console.warn('CommunityClient.verifyMembership:', err.message);
      if (this.soft) return { approved: true, role: null };
      throw err;
    }
  }

  async isModerator(userId, groupId, token) {
    const m = await this.verifyMembership(userId, groupId, token);
    return m.approved && (m.role === 'owner' || m.role === 'moderator');
  }
}

module.exports = CommunityClient;
