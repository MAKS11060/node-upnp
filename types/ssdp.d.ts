/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import dgram from 'dgram';
import { EventEmitter } from 'events';
import { AddressInfo } from 'net';
export interface SSDPOptions {
    /** default: '239.255.255.250' */
    multicastAddress?: string | '239.255.255.250';
    /** default: 1900 */
    port?: number | 1900;
    /** default: 0 */
    sourcePort?: number;
    /** default: 3000 ms */
    timeout?: number;
}
interface SSDPResponse {
    headers: Record<string, string>;
    rinfo: dgram.RemoteInfo;
    linfo: AddressInfo;
    msg: string;
}
export declare class Ssdp extends EventEmitter {
    private readonly multicast;
    private readonly port;
    private readonly sourcePort;
    private readonly timeout;
    private sockets;
    private _destroyed;
    private waitBound;
    constructor(options?: SSDPOptions);
    search(device: string): Promise<PromiseSettledResult<SSDPResponse>[]>;
    destroy(): void;
    private createSockets;
    private getNetworkInterfaces;
    private createSocket;
    private _parseResponse;
    private _parseCommand;
    private _getMethod;
    private _getHeaders;
}
export {};
