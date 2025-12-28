/**
 * Represents a connectable device (Android, iOS, or Desktop)
 */
export interface IDevice {
    id: string; // Unique ID (e.g., ADB serial, UUID)
    name: string; // User-friendly name (e.g., "Pixel 7", "iPhone 14")
    platform: 'android' | 'ios' | 'desktop' | 'web';
    type: 'physical' | 'emulator';
    status: 'connected' | 'offline' | 'unauthorized' | 'booting';
    details?: string; // Extra info like API level or OS version
}

/**
 * Service to manage device discovery and selection
 */
export interface IDeviceService {
    getConnectedDevices(): Promise<IDevice[]>;
    getSelectedDevice(): IDevice | undefined;
    selectDevice(device: IDevice): void;
    onDeviceChanged: (callback: (device: IDevice | undefined) => void) => void;
    onDevicesUpdated: (callback: (devices: IDevice[]) => void) => void;
}
