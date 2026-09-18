import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../shadcn-ui/apps/v4/registry/new-york-v4/ui/form';
import { Toaster } from '../../../../shadcn-ui/apps/v4/registry/bases/base/ui/sonner';
import { toast } from 'sonner';

// Both framework adapters use the same visible text, initial value, action,
// and validation rule. Only the public form and toast state APIs differ.
export function FormScenario() {
  const form = useForm({ defaultValues: { email: 'ada@example.com' } });
  return (
    <Form {...form}>
      <form className="fixture-form" onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: 'Email is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <input {...field} className="base-input" data-visual-form-input="" />
              </FormControl>
              <FormDescription>We will not share your email.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button className="base-button" data-visual-form-submit="" type="submit">
          Save
        </button>
      </form>
    </Form>
  );
}

export function SonnerScenario() {
  return (
    <>
      <button
        className="base-button"
        data-visual-trigger=""
        onClick={() => toast.success('Saved', { description: 'Your changes were saved.', duration: 60000 })}
      >
        Show toast
      </button>
      <Toaster position="bottom-right" visibleToasts={1} />
    </>
  );
}
