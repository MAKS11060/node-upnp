/// <reference types="node" />
import Device from './device.js';
declare type Protocol = 'TCP' | 'UDP';
interface PortMapping {
    remote: {
        host: string;
        port: number;
    };
    internal: {
        host: string;
        port: number;
    };
    protocol: Protocol;
    enabled: boolean;
    description: string;
    ttl: number;
    local: boolean;
}
interface MappingOptions {
    ttl?: number;
    remote?: {
        host?: string;
        port?: number;
    };
    internal: {
        host?: string;
        port: number;
    };
    protocol?: Protocol;
    description?: string;
    enabled?: boolean;
}
interface UnmappingOptions {
    protocol?: Protocol;
    host?: string;
    port: number;
}
export default class UPnP {
    private ssdp;
    private readonly _protocols;
    constructor();
    static createClient(): UPnP;
    createGateway(): Promise<{
        device: Device;
        rinfo: import("dgram").RemoteInfo;
        linfo: import("net").AddressInfo;
    }>;
    externalIp(): Promise<string>;
    getMappings(): Promise<PortMapping[]>;
    portMapping(options: MappingOptions): Promise<MappingOptions>;
    portUnmapping(options: UnmappingOptions): Promise<any>;
}
export {};
