/**
 * Guard for video file validation
 */

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}
