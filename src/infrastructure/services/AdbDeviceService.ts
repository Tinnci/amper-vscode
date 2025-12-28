import { IDevice, IDeviceService } from '../../domain/interfaces/IDeviceService';
import { IProcessExecutor } from '../../domain/interfaces/IProcessExecutor';
import * as vscode from 'vscode';
import { Logger } from '../../infrastructure/services/Logger';

export class AdbDeviceService implements IDeviceService {
    private selectedDevice: IDevice | undefined;
    private devices: IDevice[] = [];
    private deviceChangeListeners: ((device: IDevice | undefined) => void)[] = [];
    private listUpdateListeners: ((devices: IDevice[]) => void)[] = [];
    private checkInterval: NodeJS.Timeout | undefined;

    constructor(private executor: IProcessExecutor) {
        // Start polling for devices
        this.startPolling();
    }

    async getConnectedDevices(): Promise<IDevice[]> {
        try {
            // Run adb devices -l
            // Output format:
            // List of devices attached
            // HT75B0200001           device product:marlin model:Pixel_XL device:marlin transport_id:1
            // emulator-5554          device product:sdk_gphone_x86_64 model:Android_SDK_built_for_x86_64 device:generic_x86_64 transport_id:2

            const output = await this.executor.exec('adb', ['devices', '-l']);
            return this.parseAdbOutput(output);
        } catch (error) {
            Logger.warn('Failed to list Android devices via ADB', error);
            // If adb is not in path or fails, return empty list instead of crashing
            return [];
        }
    }

    getSelectedDevice(): IDevice | undefined {
        return this.selectedDevice;
    }

    selectDevice(device: IDevice): void {
        this.selectedDevice = device;
        this.deviceChangeListeners.forEach(l => l(device));
    }

    onDeviceChanged(callback: (device: IDevice | undefined) => void): void {
        this.deviceChangeListeners.push(callback);
    }

    onDevicesUpdated(callback: (devices: IDevice[]) => void): void {
        this.listUpdateListeners.push(callback);
    }

    dispose() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    private startPolling() {
        // Initial check
        this.refreshDevices();

        // Poll every 3 seconds for device changes
        // In a more advanced implementation, we could use `adb track-devices` for push-based updates
        this.checkInterval = setInterval(() => this.refreshDevices(), 3000);
    }

    private async refreshDevices() {
        const currentDevices = await this.getConnectedDevices();

        // Simple equality check to avoid spamming events
        const isDifferent = JSON.stringify(this.devices) !== JSON.stringify(currentDevices);

        if (isDifferent) {
            this.devices = currentDevices;
            this.listUpdateListeners.forEach(l => l(this.devices));

            // If selected device disconnected, clear selection
            if (this.selectedDevice && !this.devices.find(d => d.id === this.selectedDevice?.id)) {
                this.selectedDevice = undefined;
                this.deviceChangeListeners.forEach(l => l(undefined));
            }

            // Auto-select if only one device connected and none selected
            if (!this.selectedDevice && this.devices.length === 1) {
                this.selectDevice(this.devices[0]);
            }
        }
    }

    private parseAdbOutput(output: string): IDevice[] {
        const lines = output.split('\n');
        const devices: IDevice[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('List of devices')) {
                continue;
            }

            // Simple regex to parse standard adb output
            // Serial State ...details...
            const match = trimmed.match(/^(\S+)\s+(\w+)\s+(.*)$/);
            if (match) {
                const id = match[1];
                const stateStr = match[2];
                const detailsStr = match[3];

                let status: IDevice['status'] = 'offline';
                if (stateStr === 'device') {
                    status = 'connected';
                } else if (stateStr === 'unauthorized') {
                    status = 'unauthorized';
                }

                // Parse model from details: model:Pixel_XL
                const modelMatch = detailsStr.match(/model:(\S+)/);
                const name = modelMatch ? modelMatch[1].replace(/_/g, ' ') : id;

                const isEmulator = id.startsWith('emulator-') || detailsStr.includes('emulator');

                devices.push({
                    id,
                    name,
                    platform: 'android',
                    type: isEmulator ? 'emulator' : 'physical',
                    status,
                    details: detailsStr
                });
            }
        }

        return devices;
    }
}
