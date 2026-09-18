import {
  createForm,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../../shadcn-ui/packages/solid/src/form';
import { Toaster, toast } from '../../../../shadcn-ui/packages/solid/src/sonner';

// These inputs match apps/reference/parity-scenarios.tsx. Different framework
// state APIs stay isolated here, outside the shared fixture and upstream files.
export function FormScenario() {
  const form = createForm({
    defaultValues: { email: 'ada@example.com' },
    validate(values) {
      return { email: String(values.email).trim() ? undefined : 'Email is required' };
    },
  });
  return (
    <Form control={form}>
      <form class="fixture-form" onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl
                render={(controlProps) => (
                  <input
                    {...controlProps}
                    class="base-input"
                    data-visual-form-input=""
                    value={String(field.value ?? '')}
                    onInput={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <FormDescription>We will not share your email.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button class="base-button" data-visual-form-submit="" type="submit">
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
        class="base-button"
        data-visual-trigger=""
        onClick={() => toast.success('Saved', { description: 'Your changes were saved.', duration: 60000 })}
      >
        Show toast
      </button>
      <Toaster />
    </>
  );
}
