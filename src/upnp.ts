import {Device} from './device.js'
import {Ssdp, SSDPOptions} from './ssdp.js'

type Protocol = 'TCP' | 'UDP'

interface UPnPOptions {
	/** Default: `['TCP']` */
	protocol: Protocol[]
	/** Default: `Node.js UPnP` */
	description?: string
	/** Default: 3600 seconds
	 * - `0` = Permanent open
	 **/
	ttl?: number
	ssdp?: SSDPOptions
}

interface Mapping {
	/** Default: `''` access all hosts
	 *  - access to a specific host */
	remoteHost?: string
	/** Default: `3000`
	 *  - public port */
	remotePort: number
	/** Default: `TCP`
	 *  - if undefined, used Global options */
	protocol?: Protocol
	/** Default: `''`
	 *  - IP localhost */
	internalHost?: string
	/** Default: 3000
	 *  - if undefined, used `remotePort` */
	internalPort?: number
	/** Default: `true` */
	enabled?: boolean
	/** Default: Node.js UPnP */
	description?: string
	/** Default: 3600 seconds
	 * - `0` = Permanent open
	 **/
	ttl?: number
}

interface Unmapping {
	/** Default: `''` access all hosts
	 *  - access to a specific host */
	remoteHost?: string
	/** Default: `3000`
	 *  - public port */
	remotePort: number
	/** Default: `TCP`
	 *  - if undefined, used Global options */
	protocol?: Protocol
}

interface GenericPortMappingEntry {
	NewRemoteHost: string
	NewExternalPort: string
	NewProtocol: string
	NewInternalPort: string
	NewInternalClient: string
	NewEnabled: string
	NewPortMappingDescription: string
	NewLeaseDuration: string
}

interface GetMappingOptions {
	/** Ignore `Description` filter. Show all active UPnP clients e.g. `QBitTorrent/x.x.x` */
	allClients?: boolean

	/** Ignore `InternalHost` filter. Show all clients on LAN */
	allDevices?: boolean
}

export class UPnP {
	private readonly ssdp: Ssdp
	private readonly ssdpDevice = 'urn:schemas-upnp-org:device:InternetGatewayDevice:1'

	constructor(readonly options: UPnPOptions) {
		this.ssdp = new Ssdp(this.options?.ssdp)

		if (!options.description) options.description = 'Node.js UPnP'
		if (!options.ttl) options.ttl = 3600
	}

	async createGateway() {
		const res = await this.ssdp.search(this.ssdpDevice)
		const data = res.find(value => value.status == 'fulfilled')
		if (data.status == 'fulfilled') {
			// console.log(`[${this.constructor.name}]`, value)
			const {linfo, rinfo} = data.value
			return {linfo, rinfo, device: new Device(data.value.headers.location)}
		}
	}

	/** Get public address */
	async externalAddress(): Promise<string> {
		const gateway = await this.createGateway()
		const data = await gateway.device.run('GetExternalIPAddress')

		let key = null
		Object.keys(data).some(k => {
			if (!/:GetExternalIPAddressResponse$/.test(k)) return false
			key = k
			return true
		})
		if (key) return data[key].NewExternalIPAddress

		throw new Error('Invalid response')
	}

	/** Add mapping rule */
	async mapping(options: Mapping) {
		if (undefined === options.protocol) {
			for (let protocol of this.options.protocol) {
				await this.mapping({...options, protocol})
			}
			return
		}

		const gateway = await this.createGateway()

		if (options.remotePort < 1 || options.remotePort > 65536) throw new RangeError('Port out of range 1 <=> 65536')
		if (!options.remotePort) options.internalPort = options.remotePort
		if (options.internalPort < 1 || options.internalPort > 65536) throw new RangeError('Port out of range 1 <=> 65536')

		await gateway.device.run('AddPortMapping', [
			['NewRemoteHost', options?.remoteHost ?? ''],
			['NewExternalPort', options?.remotePort ?? 3000],
			['NewProtocol', options?.protocol?.toUpperCase() || 'TCP'],
			['NewInternalPort', options?.internalPort ?? options?.remotePort ?? 3000],
			['NewInternalClient', options?.internalHost ?? gateway.linfo.address],
			['NewEnabled', Number(Boolean(options?.enabled ?? true))],
			['NewPortMappingDescription', options?.description ?? this.options?.description ?? ''],
			['NewLeaseDuration', options.ttl ?? this.options.ttl],
		])
	}

	/** Remove mapping rule */
	async unmapping(options: Unmapping) {
		if (undefined === options.protocol) {
			for (let protocol of this.options.protocol) {
				await this.unmapping({...options, protocol})
			}
			return
		}

		const gateway = await this.createGateway()

		await gateway.device.run('DeletePortMapping', [
			['NewRemoteHost', options?.remoteHost ?? ''],
			['NewExternalPort', options?.remotePort ?? 3000],
			['NewProtocol', options?.protocol?.toUpperCase() || 'TCP'],
		])
	}

	/** Get mapping rule */
	async getMapping(options?: GetMappingOptions): Promise<Readonly<Mapping>[]> {
		const gateway = await this.createGateway()

		async function* getEntry(): AsyncIterable<GenericPortMappingEntry> {
			let i = 0
			while (true) {
				const res = await gateway.device.run('GetGenericPortMappingEntry', [['NewPortMappingIndex', i++]])
					.catch(() => null)
				if (!res) break

				for (const key in res) if (/:GetGenericPortMappingEntryResponse/.test(key)) yield res[key]
			}
		}

		let result: GenericPortMappingEntry[] = []
		for await (const item of getEntry()) result.push(item)
		return result.map(entry => ({
			remoteHost: entry.NewRemoteHost,
			remotePort: Number(entry.NewExternalPort),
			protocol: entry.NewProtocol,
			internalHost: entry.NewInternalClient,
			internalPort: Number(entry.NewInternalPort),
			ttl: Number(entry.NewLeaseDuration),
			enabled: entry.NewEnabled === '1',
			description: entry.NewPortMappingDescription,
		} as Mapping))
			.filter(entry => {
				if (options?.allClients && entry.description !== this.options?.description) return true
				if (options?.allDevices && entry.internalHost != gateway.linfo.address) return true
			})
	}

	destroy() {
		this.ssdp.destroy()
	}
}
