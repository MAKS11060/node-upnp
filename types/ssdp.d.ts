/// <reference types="node" />
import { EventEmitter } from 'events';
import dgram from 'dgram';
import { NetworkInterfaceInfoIPv4, NetworkInterfaceInfoIPv6 } from 'os';
import { AddressInfo } from 'net';
export default class ssdp extends EventEmitter {
    private readonly multicast;
    private readonly port;
    private sockets;
    private _destroyed;
    private readonly _sourcePort;
    private _bound;
    private _queue;
    private readonly response_timeout;
    constructor(options?: {
        multicast_ip?: string | '239.255.255.250';
        multicast_port?: number | 1900;
        source_port?: number | 0;
        response_timeout?: number | 5000;
    });
    createSockets(): void;
    createSocket(interf: NetworkInterfaceInfoIPv4 | NetworkInterfaceInfoIPv6): dgram.Socket;
    ready(): void;
    search(device: string): Promise<{
        status: 'fulfilled' | 'rejected';
        reason?: any;
        value: {
            rinfo: dgram.RemoteInfo;
            linfo: AddressInfo;
            headers: {
                [k: string]: string;
            };
            msg: string;
        };
    }[]>;
    _parseResponse(msg: string, rinfo: dgram.RemoteInfo, linfo: AddressInfo): {
        rinfo: dgram.RemoteInfo;
        linfo: AddressInfo;
        headers: {};
        msg: string;
    };
    _parseCommand(msg: any): {
        method: any;
        headers: {};
    };
    _getMethod(msg: any): any;
    _getHeaders(msg: any): {};
    destroy(): void;
}
