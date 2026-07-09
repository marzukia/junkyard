# Video Splicer

A standalone video splicing tool that allows users to combine multiple video clips into one, running entirely in the browser using ffmpeg.wasm.

## Features

- Combine multiple video clips into one
- Drag and drop to reorder clips  
- Runs entirely in browser - no upload required
- No signup, no watermark

## Development

```bash
cd apps/splice
bun run dev
```

## Build

```bash
bun run build
```

Both `tsc` and `vite build` should pass cleanly.
