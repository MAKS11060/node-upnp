export default class Device {
    private readonly url;
    private readonly services;
    constructor(url: any);
    run(action: string, args: any[]): Promise<any>;
    _getService(types: any): Promise<{
        service: any;
        SCPDURL: string;
        controlURL: string;
    }>;
    _getXml(url: any): Promise<any>;
    _parseDescription(info: any): {
        services: any[];
        devices: any[];
    };
    _getNamespace(data: any, uri: any): string;
}
