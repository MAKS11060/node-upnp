import dgram, {Socket} from 'dgram'
import {EventEmitter} from 'events'
import {AddressInfo} from 'net'
import {NetworkInterfaceInfo, networkInterfaces} from 'os'

// const httpHeader = /HTTP\/\d{1}\.\d{1} \d+ .*/
const ssdpHeader = /^([^:]+):\s*(.*)$/

export interface SSDPOptions {
	/** default: '239.255.255.250' */
	multicastAddress?: string | '239.255.255.250'
	/** default: 1900 */
	port?: number | 1900
	/** default: 0 */
	sourcePort?: number
	/** default: 3000 ms */
	timeout?: number
}

interface SSDPResponse {
	headers: Record<string, string>
	rinfo: dgram.RemoteInfo
	linfo: AddressInfo
	msg: string
}

export class Ssdp extends EventEmitter {
	private readonly multicast: string = '239.255.255.250'
	private readonly port: number = 1900
	private readonly sourcePort: number = 0
	private readonly timeout: number = 3000

	private sockets: Set<Socket> = new Set
	private _destroyed: boolean = false

	private waitBound = new Promise((resolve, reject) => {
		this.once('bound', resolve)
		setTimeout(reject, 5000) // TODO: remove constant
	})

	constructor(options?: SSDPOptions) {
		super()

		if (options) {
			for (let key of Object.keys(options)) {
				this[key] = options[key]
			}
		}

		this.createSockets() // init sockets for network interfaces
	}

	async search(device: string) {
		if (!await this.waitBound) throw new Error('Not bound')

		const query = Buffer.from(
			'M-SEARCH * HTTP/1.1\r\n' +
			'HOST: ' + this.multicast + ':' + this.port + '\r\n' +
			'MAN: "ssdp:discover"\r\n' +
			'MX: 1\r\n' +
			'ST: ' + device + '\r\n' +
			'\r\n',
		)

		return Promise.allSettled([...this.sockets.values()].map(socket => {
			return new Promise<SSDPResponse>((resolve, reject) => {
				socket.on('message', (msg, rinfo) => {
					resolve(this._parseResponse(msg.toString(), rinfo, socket.address()))
				})
				// socket.on('listening', () => {})
				socket.send(query, 0, query.length, this.port, this.multicast)
				setTimeout(reject, this.timeout, {error: 'timeout', info: socket.address()})
			})
		}))
	}

	destroy() {
		this._destroyed = true
		for (const socket of [...this.sockets.values()]) {
			socket.close()
			this.sockets.delete(socket)
		}
	}

	private createSockets() {
		if (this._destroyed) throw new Error('client is destroyed')
		for (const networkInterface of this.getNetworkInterfaces()) {
			this.sockets.add(this.createSocket(networkInterface))
		}
		// this.sockets = this.getNetworkInterfaces().map(int => this.createSocket(int))
	}

	private getNetworkInterfaces(): NetworkInterfaceInfo[] {
		return Object.entries(networkInterfaces()).map(([, v]) => v).flat()
			.filter(int => !int.internal && int.family == 'IPv4')
	}

	private createSocket(interfaceInfo: NetworkInterfaceInfo): Socket {
		const socket = dgram.createSocket(interfaceInfo.family === 'IPv4' ? 'udp4' : 'udp6')

		socket.on('error', () => {
			if (socket) socket.close()
		})
		socket.on('close', () => {
			this.sockets.delete(socket)
		})
		socket.on('listening', () => {
			this.emit('bound', true)
		})

		socket.bind(this.sourcePort, interfaceInfo.address)

		return socket
	}

	private _parseResponse(msg: string, rinfo: dgram.RemoteInfo, linfo: AddressInfo) {
		const {headers} = this._parseCommand(msg)
		return {headers, rinfo, linfo, msg}
	}

	private _parseCommand(msg: string) {
		const method = this._getMethod(msg)
		const headers = this._getHeaders(msg)
		return {method, headers}
	}

	private _getMethod(msg: string) {
		let lines = msg.split('\r\n')
		let type = lines.shift().split(' ')
		return (type[0] || '').toLowerCase()
	}

	private _getHeaders(msg: string) {
		let lines = msg.split('\r\n')
		let headers = {}

		lines.forEach(line => {
			if (line.length) {
				let pairs = line.match(ssdpHeader)
				if (pairs) headers[pairs[1].toLowerCase()] = pairs[2] // e.g. {'host': 239.255.255.250:1900}
			}
		})

		return headers
	}
}
