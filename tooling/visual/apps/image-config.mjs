import { imageConfigDefault } from './reference/node_modules/next/dist/esm/shared/lib/image-config.js';

// The three remote patterns in the pinned shadcn apps/v4/next.config.mjs.
export const visualImageConfig = {
  ...imageConfigDefault,
  remotePatterns: ['avatars.githubusercontent.com', 'images.unsplash.com', 'avatar.vercel.sh'].map(
    (hostname) => ({ protocol: 'https', hostname }),
  ),
};
