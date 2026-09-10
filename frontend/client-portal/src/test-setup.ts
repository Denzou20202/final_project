import { TextDecoder, TextEncoder } from 'node:util';
// Jest renders <App /> directly, bypassing main.tsx's bootstrap — without
// this, react-i18next's t() falls back to raw keys ('auth.helpLink') since
// i18next was never initialized.
import './i18n.js';

// react-router@7 (pulled in via react-router-dom) references TextEncoder/
// TextDecoder at module-load time — real globals in Node and in a real
// browser, but jsdom's simulated window doesn't provide them, so importing
// react-router-dom from a spec file throws "TextEncoder is not defined"
// without this. Not needed before the react-router-dom v6→v7 bump; v6
// never touched these.
Object.assign(globalThis, { TextEncoder, TextDecoder });
