export declare class Device {
    private readonly url;
    private readonly services;
    constructor(url: string);
    run(action: string, args?: any[]): Promise<any>;
    private getService;
    private getXml;
    private parseDescription;
    private getNamespace;
}
