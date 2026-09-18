import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { Button as Primitive } from '@base-ui/react/button';

const variants = cva('cn-candidate', {
  variants: { tone: { plain: 'bg-white' } },
  defaultVariants: { tone: 'plain' },
});

function Candidate({
  className,
  tone = 'plain',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof variants>) {
  return (
    <Primitive
      data-tone={tone}
      className={cn(variants({ tone }), className)}
      render={<button aria-label="Candidate one" />}
      {...props}
    />
  );
}

export { Candidate, variants };
