# Presentation Layer (UI)

This folder contains the new, unified presentation layer used by the extension webviews.

Structure:

- primitives/ — thin re-exports of shared UI primitives from `src/components/ui/*`
- pages/
  - chat/ — Chat webview React page
  - dashboard/ — Documents (Dashboard) webview React page

Notes:
- The legacy folder `src/nivel1/webviews/` is deprecated and not referenced by the app. It will be removed.
- The app entry (`src/App.tsx`) renders `pages/chat` by default and `pages/dashboard` when the root element has `data-page="documents"`.
- Webview providers:
  - Chat: `src/adapters/primary/vscode/chat/ChatViewProvider.ts`
  - Documents: `src/adapters/primary/vscode/documents/DocumentsViewProvider.ts`

Migration checklist:
- [x] Move Chat page to `nivel1/ui/pages/chat/ChatView.tsx`
- [x] Move Documents page to `nivel1/ui/pages/dashboard/DocumentsPage.tsx`
- [x] Point `src/App.tsx` imports to `nivel1/ui/pages/*`
- [ ] Remove `src/nivel1/webviews/*` folder (deprecated)
- [ ] Remove transitional bridges `src/nivel1/ui/Button.tsx` and `src/nivel1/ui/Card.tsx` if unused
