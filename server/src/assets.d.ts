// Files the server imports as text or as a path (`with { type: 'text' }` or
// `'file'`), so the `bica` binary embeds them too.

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  const path: string;
  export default path;
}

declare module 'echarts/dist/echarts.min.js' {
  const path: string;
  export default path;
}

declare module '@tailwindcss/browser' {
  const path: string;
  export default path;
}
