import serverless from 'serverless-http';
import { app } from '../../server/app';

// Netlify's redirect target can be reflected in the Lambda event path.
// Restore the site's original route before passing requests to Express.
const prefix = '/.netlify/functions/site';
export const handler = serverless(app, {
  request(request: any, event: any) {
    const eventPath = String(event.path || '/');
    const routedPath = eventPath === prefix ? '/' :
      eventPath.startsWith(prefix + '/') ? eventPath.slice(prefix.length) : eventPath;
    const params = new URLSearchParams();
    const supplied = event.multiValueQueryStringParameters || event.queryStringParameters || {};
    for (const [key, value] of Object.entries(supplied)) {
      if (Array.isArray(value)) {
        for (const item of value) if (item !== undefined && item !== null) params.append(key, String(item));
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const query = event.rawQueryString || params.toString();
    request.url = routedPath + (query ? '?' + query : '');
  },
});
