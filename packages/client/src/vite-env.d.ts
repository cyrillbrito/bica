/// <reference types="vite/client" />
/// <reference types="../file-routes.d.ts" />

declare module 'lucide/dist/esm/icons/*.mjs' {
  const icon: import('lucide').IconNode;
  export default icon;
}
