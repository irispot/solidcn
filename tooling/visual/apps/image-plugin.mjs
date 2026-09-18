import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { visualImageConfig } from './image-config.mjs';

const require = createRequire(new URL('./reference/package.json', import.meta.url));
const {
  ImageOptimizerCache,
  fetchExternalImage,
  imageOptimizer,
} = require('next/dist/server/image-optimizer.js');
const cache = new Map();

/** Serve the pinned Next optimizer for both apps, without changing example props. */
export function visualImagePlugin(framework) {
  const configSource = readFileSync(
    new URL('../../../shadcn-ui/apps/v4/next.config.mjs', import.meta.url),
    'utf8',
  );
  for (const pattern of visualImageConfig.remotePatterns)
    if (!configSource.includes(`hostname: "${pattern.hostname}"`))
      throw new Error(`Upstream image configuration changed: ${pattern.hostname}`);
  return {
    name: 'original-next-image-service',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname !== '/_next/image') return next();
        try {
          if (framework === 'solid') {
            const response = await fetch(`http://127.0.0.1:5181${req.url}`, {
              headers: { accept: req.headers.accept ?? '' },
            });
            res.statusCode = response.status;
            res.setHeader(
              'Content-Type',
              response.headers.get('content-type') ?? 'application/octet-stream',
            );
            res.end(Buffer.from(await response.arrayBuffer()));
            return;
          }
          const config = { images: structuredClone(visualImageConfig), experimental: {} };
          const params = ImageOptimizerCache.validateParams(
            req,
            Object.fromEntries(url.searchParams),
            config,
            true,
          );
          if ('errorMessage' in params) throw new Error(params.errorMessage);
          if (!params.isAbsolute)
            throw new Error(
              'The documentation image service supports configured remote images only.',
            );
          const key = `${req.url}:${req.headers.accept ?? ''}`;
          if (!cache.has(key))
            cache.set(
              key,
              (async () => {
                const upstream = await fetchExternalImage(
                  params.href,
                  false,
                  config.images.maximumResponseBody,
                );
                return imageOptimizer(upstream, params, config, { isDev: true });
              })(),
            );
          const image = await cache.get(key);
          res.setHeader('Content-Type', image.contentType);
          res.setHeader('ETag', image.etag);
          res.end(image.buffer);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end(`Original image service failed: ${error.message}`);
        }
      });
    },
  };
}
