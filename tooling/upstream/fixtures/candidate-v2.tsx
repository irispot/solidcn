import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Button as Primitive } from '@base-ui/react/button';

const variants = cva('cn-candidate-v2', {
  variants: { tone: { plain: 'bg-white', warning: 'bg-amber-100' } },
  defaultVariants: { tone: 'warning' },
});

function Candidate({
  className,
  tone = 'warning',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof variants>) {
  return (
    <Primitive
      data-tone={tone}
      className={cn(variants({ tone }), className)}
      render={<button aria-label="Candidate two" title="New upstream title" />}
      {...props}
    />
  );
}

export { Candidate, variants };
