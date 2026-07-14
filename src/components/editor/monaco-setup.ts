import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
// Vite bundles these workers locally (note the `?worker` suffix) — Monaco is
// therefore fully self-hosted and never fetched from a CDN, satisfying the
// localhost-only security model.
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

/**
 * Point @monaco-editor/react at the bundled monaco instance + local workers.
 * Imported once for its side effects before the app renders.
 */
self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });
