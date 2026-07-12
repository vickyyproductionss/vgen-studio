import https from 'https';
import http from 'http';
import dns from 'dns';

/**
 * Creates an HTTP or HTTPS Agent that overrides Node's default DNS lookup
 * for Cloudflare Tunnel domains (*.trycloudflare.com). It queries DNS servers
 * directly via dns.resolve4 to bypass the macOS resolver cache.
 *
 * @param {string} url - The target URL to resolve
 * @returns {import('http').Agent} The configured Agent instance
 */
export function getCustomAgent(url) {
  const isHttps = url.startsWith('https');
  const AgentClass = isHttps ? https.Agent : http.Agent;
  
  return new AgentClass({
    keepAlive: true,
    lookup: (hostname, options, callback) => {
      // Normalize arguments since options is optional
      let actualOptions = options;
      let actualCallback = callback;
      if (typeof options === 'function') {
        actualCallback = options;
        actualOptions = {};
      }

      if (hostname.endsWith('.trycloudflare.com')) {
        dns.resolve4(hostname, (err, addresses) => {
          if (err || !addresses.length) {
            // Fall back to standard OS resolver if direct query fails
            dns.lookup(hostname, options, callback);
          } else {
            if (actualOptions && actualOptions.all) {
              // Node's dns.lookup returns an array of objects if options.all is true
              const addrArray = addresses.map(addr => ({ address: addr, family: 4 }));
              actualCallback(null, addrArray);
            } else {
              // Return first IP address directly
              actualCallback(null, addresses[0], 4);
            }
          }
        });
      } else {
        dns.lookup(hostname, options, callback);
      }
    }
  });
}
