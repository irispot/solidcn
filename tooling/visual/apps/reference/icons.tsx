import * as React from 'react';
import * as Lucide from 'lucide-react';

// The upstream registry icon placeholder depends on its Next.js design-system
// editor. Select its Lucide option as the registry installer does. This adapter
// changes only icon selection, not the original control source or its styles.
export function IconPlaceholder({ lucide, tabler, hugeicons, phosphor, remixicon, ...props }) {
  const Icon = Lucide[lucide];
  if (!Icon) throw new Error(`Missing reference Lucide icon: ${lucide}`);
  return <Icon {...props} />;
}
