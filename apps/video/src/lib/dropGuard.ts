/** Returns true if the File MIME type indicates a video stream. */
export function isVideoFile(file: Pick<File, "type">): boolean {
  return file.type.startsWith("video/");
}
