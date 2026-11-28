import { useKeepAwake } from 'expo-keep-awake';
import { usePreventScreenCapture } from 'expo-screen-capture';

/**
 * Mount only while the signed QR is on screen. Keeping this out of the ticket
 * screen means a checked-in or unpaid ticket never blocks screenshots.
 */
export function QrGuard() {
  usePreventScreenCapture('attendee-ticket');
  useKeepAwake();
  return null;
}
