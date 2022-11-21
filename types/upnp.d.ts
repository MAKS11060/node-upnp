/// <reference types="node" />
/// <reference types="node" />
import { Device } from './device.js';
import { SSDPOptions } from './ssdp.js';
type Protocol = 'TCP' | 'UDP';
interface UPnPOptions {
    /** Default: `['TCP']` */
    protocol: Protocol[];
    /** Default: `Node.js UPnP` */
    description?: string;
    /** Default: 3600 seconds
     * - `0` = Permanent open
     **/
    ttl?: number;
    ssdp?: SSDPOptions;
}
interface Mapping {
    /** Default: `''` access all hosts
     *  - access to a specific host */
    remoteHost?: string;
    /** Default: `3000`
     *  - public port */
    remotePort: number;
    /** Default: `TCP`
     *  - if undefined, used Global options */
    protocol?: Protocol;
    /** Default: `''`
     *  - IP localhost */
    internalHost?: string;
    /** Default: 3000
     *  - if undefined, used `remotePort` */
    internalPort?: number;
    /** Default: `true` */
    enabled?: boolean;
    /** Default: Node.js UPnP */
    description?: string;
    /** Default: 3600 seconds
     * - `0` = Permanent open
     **/
    ttl?: number;
}
interface Unmapping {
    /** Default: `''` access all hosts
     *  - access to a specific host */
    remoteHost?: string;
    /** Default: `3000`
     *  - public port */
    remotePort: number;
    /** Default: `TCP`
     *  - if undefined, used Global options */
    protocol?: Protocol;
}
interface GetMappingOptions {
    /** Ignore `Description` filter. Show all active UPnP clients e.g. `QBitTorrent/x.x.x` */
    allClients?: boolean;
    /** Ignore `InternalHost` filter. Show all clients on LAN */
    allDevices?: boolean;
}
export declare class UPnP {
    readonly options: UPnPOptions;
    private readonly ssdp;
    private readonly ssdpDevice;
    constructor(options: UPnPOptions);
    createGateway(): Promise<{
        linfo: import("net").AddressInfo;
        rinfo: import("dgram").RemoteInfo;
        device: Device;
    }>;
    /** Get public address */
    externalAddress(): Promise<string>;
    /** Add mapping rule */
    mapping(options: Mapping): Promise<void>;
    /** Remove mapping rule */
    unmapping(options: Unmapping): Promise<void>;
    /** Get mapping rule */
    getMapping(options?: GetMappingOptions): Promise<Readonly<Mapping>[]>;
    destroy(): void;
}
export {};
