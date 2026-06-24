# Screen Recorder

> Free in-browser screen recorder — record, preview, download. No upload, no account. A Loom alternative.

Live at [junkyard.sh/screen-recorder/](https://junkyard.sh/screen-recorder/)

## What it does

- Captures your screen (or a window / tab) via the browser's `getDisplayMedia` API
- Optionally mixes in microphone audio and/or system audio
- Records using `MediaRecorder` (WebM/VP9 output in Chrome/Edge; VP8 fallback)
- Shows a live elapsed timer and a pulsing REC indicator during recording
- Lets you preview the recording in-page before downloading
- Downloads as `recording-N.webm`

## Error paths covered

| Scenario | Behaviour |
|---|---|
| Browser doesn't support `getDisplayMedia` | Full-page unsupported notice |
| User dismisses the capture picker | Error card with "Try again" |
| Permission denied (screen or mic) | Error card with actionable message |
| Browser's native "Stop sharing" clicked | Recording finalises cleanly |
| Any other MediaRecorder error | Error card, tracks released |

## Browser support

Chrome 72+, Edge 79+, Firefox 66+ (desktop). Safari is partial — screen capture may require explicit permission grants in System Preferences. Mobile browsers are unsupported (`getDisplayMedia` is desktop-only) and show the standard MobileWarning banner.

## Stack

- React 18 + Zustand (state)
- Vite 6, TypeScript strict, Biome
- No AI, no large downloads, no server
