import ssdp from './ssdp.js'
import Device from './device.js'


type Protocol = 'TCP' | 'UDP'

interface PortMapping {
	remote: {
		host: string
		port: number
	},
	internal: {
		host: string
		port: number
	},
	protocol: Protocol
	enabled: boolean
	description: string
	ttl: number
	local: boolean
}

interface MappingOptions {
	ttl?: number
	remote?: {
		host?: string
		port?: number
	}
	internal: {
		host?: string
		port: number
	}
	protocol?: Protocol
	description?: string
	enabled?: boolean
}

interface UnmappingOptions {
	protocol?: Protocol
	host?: string
	port: number
}


export default class UPnP {
	private ssdp: ssdp
	private readonly _protocols: string[]

	constructor() {
		this.ssdp = new ssdp()
		this._protocols = ['TCP', 'UDP']
	}

	static createClient() {
		return new UPnP()
	}

	async createGateway() {
		const [{value: {headers, rinfo, linfo}}] = await this.ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')

		const device = new Device(headers.location)
		return {device, rinfo, linfo}
	}

	async externalIp(): Promise<string> {
		const {device} = await this.createGateway()

		const data = await device.run('GetExternalIPAddress', [])

		let key = null
		Object.keys(data).some(k => {
			if (!/:GetExternalIPAddressResponse$/.test(k)) return false

			key = k
			return true
		})

		if (key) return data[key].NewExternalIPAddress

		throw new Error('Incorrect response')
	}

	async getMappings(): Promise<PortMapping[]> {
		const {device, linfo: {address}} = await this.createGateway()

		async function GetGenericPortMappingEntry(i) {
			const result = await device.run('GetGenericPortMappingEntry', [['NewPortMappingIndex', i]])
				.then(data => {
					for (const key in data) if (/:GetGenericPortMappingEntryResponse/.test(key)) return data[key]
				})
				.then(data => ({
					remote: {
						host: typeof data.NewRemoteHost === 'string' && data.NewRemoteHost || '',
						port: parseInt(data.NewExternalPort, 10)
					},
					internal: {
						host: data.NewInternalClient,
						port: parseInt(data.NewInternalPort, 10)
					},
					// protocol: data.NewProtocol.toLowerCase(),
					protocol: data.NewProtocol,
					enabled: data.NewEnabled === '1',
					description: data.NewPortMappingDescription,
					ttl: parseInt(data.NewLeaseDuration, 10),
					local: false
				}))

			result.local = result.internal.host === address
			return result
		}

		return new Promise(async (resolve, reject) => {
			let i = 0
			const results = []
			while (true) {
				try {
					const data = await GetGenericPortMappingEntry(i++)
					if (!data.protocol) {
						reject(new Error('invalid data'))
						break
					}
					results.push(data)
				} catch (e) {
					if (i === 1) continue
					resolve(results)
					break
				}
			}
			resolve(results)
		})
	}

	async portMapping(options: MappingOptions) {
		const {device, linfo: {address}} = await this.createGateway()

		if (!options.remote) options.remote = {}
		const {remote, internal} = options
		if (!remote.port) remote.port = internal.port
		if (!internal.host) internal.host = address

		options.protocol = typeof options.protocol === 'string' ? options.protocol : 'TCP'
		if (!this._protocols.includes(options.protocol.toUpperCase())) throw new TypeError(`Incorrect protocol type: ${options.protocol}`)

		options.enabled = typeof options.enabled === 'boolean' ? options.enabled : true
		options.description = typeof options.description === 'string' ? options.description : 'node:port-mapper'
		options.ttl = typeof options.ttl === 'number' ? options.ttl : 60 * 5

		await device.run('AddPortMapping', [
			['NewRemoteHost', remote.host],
			['NewExternalPort', remote.port],
			['NewProtocol', options.protocol.toUpperCase()],
			['NewInternalPort', internal.port],
			['NewInternalClient', internal.host || address],
			['NewEnabled', options.enabled],
			['NewPortMappingDescription', options.description],
			['NewLeaseDuration', options.ttl]
		])

		return options
	}

	async portUnmapping(options: UnmappingOptions) {
		const {device} = await this.createGateway()

		options.protocol = typeof options.protocol === 'string' ? options.protocol : 'TCP'
		if (!this._protocols.includes(options.protocol.toUpperCase())) throw new TypeError(`Incorrect protocol type: ${options.protocol}`)

		return await device.run('DeletePortMapping', [
			['NewRemoteHost', options.host],
			['NewExternalPort', options.port],
			['NewProtocol', options.protocol.toUpperCase()]
		])
	}
}
