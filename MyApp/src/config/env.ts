/**
 * Backend API configuration.
 *
 * EDIT THIS to point the app at your backend:
 *  - Android emulator (default): the emulator's host-loopback address, 10.0.2.2,
 *    maps to "localhost" on the machine running the emulator.
 *  - iOS simulator: use "http://localhost:8000/api/v1" instead (the simulator
 *    shares the host's network namespace, unlike the Android emulator).
 *  - Physical device (Android or iOS): use your development machine's LAN IP,
 *    e.g. "http://192.168.1.23:8000/api/v1" — the device and machine must be
 *    on the same network, and the backend must be started with --host 0.0.0.0.
 */
export const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

/** Network request timeout, in milliseconds. */
export const API_TIMEOUT_MS = 15000;
