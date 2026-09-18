import { createHash } from 'node:crypto';

// User-approved source-input corrections. Both renderers receive the same
// edits. The original clones and tests remain byte-for-byte unchanged.
// An upstream context change fails for review; no fuzzy patching is allowed.
export const exampleInputFixes = {
  'input-group-button.tsx': {
    reason: 'The Popover trigger renders an InputGroupAddon div, not a native button.',
    edits: [['<PopoverTrigger render={<InputGroupAddon />}>', '<PopoverTrigger nativeButton={false} render={<InputGroupAddon />}>']],
  },
  'input-otp-demo.tsx': {
    reason: 'input-otp 1.4.2 forwards defaultValue to an already controlled input. Use its controlled API.',
    edits: [
      ['import {\n  InputOTP,', '"use client"\n\nimport * as React from "react"\n\nimport {\n  InputOTP,'],
      ['export function InputOTPDemo() {', 'export function InputOTPDemo() {\n  const [value, setValue] = React.useState("123456")'],
      ['<InputOTP maxLength={6} defaultValue="123456">', '<InputOTP maxLength={6} value={value} onChange={setValue}>'],
    ],
  },
  'input-otp-rtl.tsx': {
    reason: 'Use the same controlled OTP fix for the RTL example.',
    edits: [
      ['export function InputOTPRtl() {', 'export function InputOTPRtl() {\n  const [value, setValue] = React.useState("123456")'],
      ['        defaultValue="123456"', '        value={value}\n        onChange={setValue}'],
    ],
  },
  'command-dialog.tsx': {
    reason: 'The example gives cmdk Input and List no Command root. Add their required context in both renderers.',
    edits: [
      ['  CommandDialog,\n', '  Command,\n  CommandDialog,\n'],
      ['      <CommandDialog open={open} onOpenChange={setOpen}>', '      <CommandDialog open={open} onOpenChange={setOpen}>\n        <Command>'],
      ['      </CommandDialog>', '        </Command>\n      </CommandDialog>'],
    ],
  },
  'toast-demo.tsx': {
    reason: 'The example needs the site-level Toaster to render toasts. Supply it in both isolated renderers.',
    edits: [
      ['import { toast } from "@/styles/base-nova/ui/toast"', 'import { Toaster, toast } from "@/styles/base-nova/ui/toast"'],
      ['    <Button variant="outline" onClick={showToast}>\n      Show Toast\n    </Button>', '    <Toaster>\n      <Button variant="outline" onClick={showToast}>\n        Show Toast\n      </Button>\n    </Toaster>'],
    ],
  },
};
export function fixExampleInputs(code, filename) {
  const name = filename.replaceAll('\\', '/').match(/(?:^|\/)shadcn-ui\/apps\/v4\/examples\/base\/([^/]+)$/)?.[1];
  const fix = exampleInputFixes[name];
  if (!fix) return { code, fixes: [] };
  // Some replacement text still contains its source anchor. Reject a second
  // application before matching anchors, so approved fixes run exactly once.
  if (fix.edits.every(([, to]) => code.includes(to)))
    throw new Error(`${filename}: approved example fix needs review; already applied`);
  const original = code;
  for (const [from, to] of fix.edits) {
    if (code.split(from).length !== 2)
      throw new Error(`${filename}: approved example fix needs review; expected exactly one context: ${from}`);
    code = code.replace(from, to);
  }
  const hash = value => createHash('sha256').update(value).digest('hex');
  return { code, fixes: [{ name, reason: fix.reason, originalSha256: hash(original), correctedSha256: hash(code) }] };
}
