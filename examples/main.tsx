import { createSignal, For } from 'solid-js';
import { render } from '@solidjs/web';
import {
  Button,
  Checkbox,
  Switch,
  NumberField,
  Slider,
  Accordion,
  Tabs,
  Dialog,
  Menu,
  Select,
  Combobox,
  Toast,
  Progress,
} from '@solid-cn/base-ui';
import { Button as StyledButton } from '@solid-cn/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@solid-cn/ui/card';
import { Input } from '@solid-cn/ui/input';
import './style.css';

const toastManager = Toast.createToastManager();
function Notifications() {
  const manager = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport class="toasts">
        <For each={manager.toasts}>
          {(toast) => (
            <Toast.Root toast={toast} class="toast">
              <Toast.Title />
              <Toast.Description />
              <Toast.Close>Close</Toast.Close>
            </Toast.Root>
          )}
        </For>
      </Toast.Viewport>
    </Toast.Portal>
  );
}
function App() {
  const [count, setCount] = createSignal(0);
  const [checked, setChecked] = createSignal(false);
  const [selected, setSelected] = createSignal<string | null>('apple');
  const [queryValue, setQueryValue] = createSignal<string | null>(null);
  return (
    <Toast.Provider toastManager={toastManager}>
      <main class="style-nova">
        <header>
          <p class="eyebrow">SOLID 2.0.0-RC.8</p>
          <h1>Base UI + Shadcn</h1>
          <p>Native Solid component preview. Full upstream test parity is not yet established.</p>
          <p>
            <a href="/tooling/visual/gallery.html">Open the example gallery</a>
          </p>
        </header>
        <section aria-label="Buttons">
          <h2>Buttons and reactive state</h2>
          <Button data-testid="counter" onClick={() => setCount(count() + 1)}>
            Count: {count()}
          </Button>
          <StyledButton
            onClick={() =>
              toastManager.add({ title: 'Saved', description: 'The Solid event handler ran.' })
            }
          >
            Show notification
          </StyledButton>
          <Button disabled>Disabled</Button>
          <Button nativeButton={false} render={(props) => <span {...props} />}>
            Custom element
          </Button>
        </section>
        <section>
          <h2>Form controls</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              toastManager.add({ title: 'Form submitted' });
            }}
          >
            <label>
              Email
              <Input name="email" type="email" placeholder="you@example.com" />
            </label>
            <label>
              <Checkbox.Root
                checked={checked()}
                onCheckedChange={(value) => setChecked(value)}
                name="agreed"
                class="check"
              >
                <Checkbox.Indicator>✓</Checkbox.Indicator>
              </Checkbox.Root>{' '}
              Accept terms
            </label>
            <output data-testid="check-value">{checked() ? 'Checked' : 'Unchecked'}</output>
            <label>
              <Switch.Root name="notifications" class="switch">
                <Switch.Thumb />
              </Switch.Root>{' '}
              Notifications
            </label>
            <NumberField.Root defaultValue={2} min={0} max={10}>
              <NumberField.Group>
                <NumberField.Decrement aria-label="Decrease">−</NumberField.Decrement>
                <NumberField.Input aria-label="Quantity" />
                <NumberField.Increment aria-label="Increase">+</NumberField.Increment>
              </NumberField.Group>
            </NumberField.Root>
            <StyledButton type="submit">Submit</StyledButton>
          </form>
        </section>
        <section>
          <h2>Slider and progress</h2>
          <Slider.Root defaultValue={25} min={0} max={100}>
            <Slider.Label>Volume</Slider.Label>
            <Slider.Control class="slider">
              <Slider.Track class="track">
                <Slider.Indicator class="indicator" />
                <Slider.Thumb class="thumb" aria-label="Volume" />
              </Slider.Track>
            </Slider.Control>
            <Slider.Value />
          </Slider.Root>
          <Progress.Root value={60}>
            <Progress.Label>Upload</Progress.Label>
            <Progress.Track class="track">
              <Progress.Indicator class="indicator" />
            </Progress.Track>
            <Progress.Value />
          </Progress.Root>
        </section>
        <section>
          <h2>Accordion</h2>
          <Accordion.Root defaultValue={['one']}>
            <Accordion.Item value="one">
              <Accordion.Header>
                <Accordion.Trigger>First section</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>First panel content</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="two">
              <Accordion.Header>
                <Accordion.Trigger>Second section</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>Second panel content</Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </section>
        <section>
          <h2>Tabs</h2>
          <Tabs.Root defaultValue="first">
            <Tabs.List>
              <Tabs.Tab value="first">Overview</Tabs.Tab>
              <Tabs.Tab value="second">Details</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="first">Overview panel</Tabs.Panel>
            <Tabs.Panel value="second">Details panel</Tabs.Panel>
          </Tabs.Root>
        </section>
        <section>
          <h2>Dialog and menu</h2>
          <Dialog.Root>
            <Dialog.Trigger>Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop class="backdrop" />
              <Dialog.Popup class="popup">
                <Dialog.Title>Solid dialog</Dialog.Title>
                <Dialog.Description>
                  Focus stays in this dialog while it is open.
                </Dialog.Description>
                <input aria-label="Dialog input" />
                <Dialog.Close>Close dialog</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Menu.Root>
            <Menu.Trigger>Open menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={8}>
                <Menu.Popup class="menu">
                  <Menu.Item onClick={() => toastManager.add({ title: 'Item selected' })}>
                    Create item
                  </Menu.Item>
                  <Menu.CheckboxItem>
                    Show details<Menu.CheckboxItemIndicator>✓</Menu.CheckboxItemIndicator>
                  </Menu.CheckboxItem>
                  <Menu.Item disabled>Unavailable</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </section>
        <section>
          <h2>Select and combobox</h2>
          <Select.Root
            value={selected()}
            onValueChange={(value) =>
              setSelected(Array.isArray(value) ? (value[0] ?? null) : value)
            }
          >
            <Select.Trigger aria-label="Fruit">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup class="menu">
                  <Select.List>
                    <Select.Item value="apple">
                      <Select.ItemText>Apple</Select.ItemText>
                      <Select.ItemIndicator>✓</Select.ItemIndicator>
                    </Select.Item>
                    <Select.Item value="pear">
                      <Select.ItemText>Pear</Select.ItemText>
                      <Select.ItemIndicator>✓</Select.ItemIndicator>
                    </Select.Item>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <output data-testid="select-value">{selected()}</output>
          <Combobox.Root
            items={['Apple', 'Banana', 'Pear']}
            value={queryValue()}
            onValueChange={(value) =>
              setQueryValue(Array.isArray(value) ? (value[0] ?? null) : value)
            }
          >
            <Combobox.Input aria-label="Search fruit" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup class="menu">
                  <Combobox.List>
                    {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
                  </Combobox.List>
                  <Combobox.Empty>No results</Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Shadcn styles</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This card and the dark buttons use the converted Shadcn source.</p>
          </CardContent>
        </Card>
        <Notifications />
      </main>
    </Toast.Provider>
  );
}
render(() => <App />, document.getElementById('app')!);
