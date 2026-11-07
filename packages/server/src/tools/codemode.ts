import { CodemodeSandbox, loadQuickJSWasm } from '@earendil-works/pi-codemode';
import { createCodemodeExtension } from '@earendil-works/pi-durable/codemode';

// Durable's codemode: scripts call the conversation's tools as nested calls
// and survive a restart. Only `ask` sets `callers: ['model']`: it ends the
// run, which a script can't do.
export const Codemode = createCodemodeExtension({
  sandbox: new CodemodeSandbox({
    // A runaway script must not grow to wasm32's 4 GiB inside the server process.
    memoryLimitBytes: 256 * 1024 * 1024,
    // The `bica` binary embeds both, where codemode can't find them itself.
    ...(process.env.BICA_CODEMODE_WASM && {
      wasm: loadQuickJSWasm(process.env.BICA_CODEMODE_WASM),
      workerUrl: process.env.BICA_CODEMODE_WORKER,
    }),
  }),
});
