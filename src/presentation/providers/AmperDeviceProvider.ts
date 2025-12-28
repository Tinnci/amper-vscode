import * as vscode from 'vscode';
import { IDevice, IDeviceService } from '../../domain/interfaces/IDeviceService';

/**
 * Tree Provider for displaying connected devices
 */
export class AmperDeviceProvider implements vscode.TreeDataProvider<DeviceTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<DeviceTreeItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private devices: IDevice[] = [];

    constructor(private deviceService: IDeviceService) {
        // Subscribe to device updates
        this.deviceService.onDevicesUpdated((updatedDevices) => {
            this.devices = updatedDevices;
            this._onDidChangeTreeData.fire();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DeviceTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DeviceTreeItem): Promise<DeviceTreeItem[]> {
        if (element) {
            return []; // Flattened list for now
        }

        if (this.devices.length === 0) {
            return [new NoDevicesItem()];
        }

        const selected = this.deviceService.getSelectedDevice();
        return this.devices.map(d => new DeviceItem(d, d.id === selected?.id));
    }
}

class DeviceTreeItem extends vscode.TreeItem { }

class DeviceItem extends DeviceTreeItem {
    constructor(device: IDevice, isSelected: boolean) {
        super(device.name, vscode.TreeItemCollapsibleState.None);

        this.contextValue = 'device';
        this.description = device.type === 'emulator' ? '(Emulator)' : '(Physical)';

        if (device.status === 'connected') {
            this.iconPath = new vscode.ThemeIcon(
                'device-mobile',
                isSelected ? new vscode.ThemeColor('charts.green') : undefined
            );
            if (isSelected) {
                this.description += ' [Active]';
                this.label = `✅ ${device.name}`; // Visual indicator
            }
        } else {
            this.iconPath = new vscode.ThemeIcon('warning');
            this.description += ` - ${device.status}`;
        }

        this.tooltip = `ID: ${device.id}\nStatus: ${device.status}\nPlatform: ${device.platform}`;

        // Command to select this device
        this.command = {
            command: 'amper-vscode.selectDevice',
            title: 'Select Device',
            arguments: [device]
        };
    }
}

class NoDevicesItem extends DeviceTreeItem {
    constructor() {
        super('No devices connected', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.description = 'Connect an Android device or start an emulator';
    }
}
