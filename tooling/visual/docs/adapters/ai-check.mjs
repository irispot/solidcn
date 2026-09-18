import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Independent native adapter checks. The original helpers/transports and all
// upstream tests remain unchanged. No network model service is contacted.
const entry = resolve(import.meta.dirname, 'ai-virtual-probe.ts');
const server = await createServer({
  configFile: resolve(import.meta.dirname, '../../apps/solid/vite.config.ts'),
  logLevel: 'error',
  plugins: [
    {
      name: 'native-ai-check',
      resolveId(id) {
        if (id === '/ai-probe.ts') return entry;
      },
      load(id) {
        if (id === entry)
          return `
      import {createRoot,createEffect} from 'solid-js';
      import {useChat as useSdk} from './ai-sdk';
      import {useChat as useTanstack} from './ai-tanstack';
      import {createChat as sdkScript} from '@shadcn/helpers/ai-sdk';
      import {createChat as tanstackScript} from '@shadcn/helpers/tanstack-ai';
      window.makeChat=(kind,scenario)=>{
        const script=(kind==='sdk'?sdkScript:tanstackScript)().user('Hello');
        if(scenario==='error')script.error('Expected protocol error');
        else script.sleep(20).assistant(({writer})=>{writer.reasoning('A real reasoning part.');writer.sleep(20);writer.text(scenario==='abort'?'A long real streamed response. '.repeat(80):'A real streamed response.');});
        const states=[];let dispose;let chat;
        createRoot(cleanup=>{
          dispose=cleanup;
          chat=kind==='sdk'?useSdk({messages:script.get(0),transport:script.transport({delayMs:5})}):useTanstack({initialMessages:script.get(0),connection:script.transport({delayMs:5})});
          createEffect(()=>chat.status,status=>{states.push(status);});
        });
        window.chat=chat;window.states=states;window.disposeChat=dispose;
        window.startChat=()=>kind==='sdk'?chat.sendMessage(script.next(chat.messages)):chat.append(script.next(chat.messages));
      };
      window.aiProbeReady=true;
    `;
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== '/ai-probe') return next();
          response.setHeader('content-type', 'text/html');
          response.end('<script type="module" src="/ai-probe.ts"></script>');
        });
      },
    },
  ],
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, ws: false },
});
let browser;
const passed = [];
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const modules = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => modules.push(response.url()));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/ai-probe`);
  await page.waitForFunction(() => window.aiProbeReady);
  for (const kind of ['sdk', 'tanstack']) {
    await page.evaluate((kind) => window.makeChat(kind, 'normal'), kind);
    await page.evaluate(() => {
      window.chatFinished = window.startChat();
    });
    await page
      .waitForFunction(() => window.states.includes('streaming'), null, { timeout: 3000 })
      .catch(async (error) => {
        throw new Error(
          `${kind}: ${JSON.stringify({ browserErrors: errors, ...(await page.evaluate(() => ({ status: window.chat.status, error: String(window.chat.error), states: window.states, messages: window.chat.messages }))) })}`,
          { cause: error },
        );
      });
    assert.equal(await page.evaluate(() => window.chat.messages[0].role), 'user');
    await page.evaluate(() => window.chatFinished);
    const result = await page.evaluate(() => ({
      status: window.chat.status,
      states: window.states,
      messages: window.chat.messages,
    }));
    assert.equal(result.status, 'ready');
    assert.ok(result.states.includes('streaming'));
    assert.deepEqual(
      result.messages.map((message) => message.role),
      ['user', 'assistant'],
    );
    assert.equal(
      result.messages[1].parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? part.content)
        .join(''),
      'A real streamed response.',
    );
    assert.equal(
      result.messages[1].parts
        .filter((part) => part.type === 'reasoning' || part.type === 'thinking')
        .map((part) => part.text ?? part.content)
        .join(''),
      'A real reasoning part.',
    );
    passed.push(`${kind}: original transport, live status, text and reasoning stream`);
    await page.evaluate(() => window.chat.setMessages([]));
    assert.equal(await page.evaluate(() => window.chat.messages.length), 0);
    passed.push(`${kind}: reset`);
    await page.evaluate(() => window.disposeChat());
    await page.evaluate((kind) => window.makeChat(kind, 'error'), kind);
    await page.evaluate(() => window.startChat());
    assert.equal(await page.evaluate(() => window.chat.status), 'error');
    assert.match(await page.evaluate(() => String(window.chat.error)), /Expected protocol error/);
    passed.push(`${kind}: protocol error propagation`);
    await page.evaluate(() => window.disposeChat());
    await page.evaluate((kind) => window.makeChat(kind, 'abort'), kind);
    await page.evaluate(() => {
      window.chatFinished = window.startChat();
    });
    await page.waitForFunction(() => window.chat.status === 'streaming');
    await page.evaluate(() => window.chat.stop());
    await page.evaluate(() => window.chatFinished);
    const count = await page.evaluate(() => JSON.stringify(window.chat.messages).length);
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => JSON.stringify(window.chat.messages).length), count);
    assert.equal(await page.evaluate(() => window.chat.status), 'ready');
    passed.push(`${kind}: stop cancels stream`);
    await page.evaluate(() => window.disposeChat());
  }
  assert.deepEqual(errors, []);
  assert.equal(
    modules.some((url) => /\/react(?:-dom)?(?:[/.?]|$)|\/deps\/react(?:_|\.)/.test(url)),
    false,
    'Native adapters must not load React',
  );
  passed.push('No React runtime loaded; no browser exceptions');
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
