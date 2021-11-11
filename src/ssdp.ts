import {EventEmitter} from 'events'
import dgram from 'dgram'
import os, {NetworkInterfaceInfoIPv4, NetworkInterfaceInfoIPv6} from 'os'
import {AddressInfo} from 'net'


const MULTICAST_IP_ADDRESS = '239.255.255.250'
const MULTICAST_PORT = 1900
const RESPONSE_TIMEOUT = 3000 //ms


// const httpHeader = /HTTP\/\d{1}\.\d{1} \d+ .*/
const ssdpHeader = /^([^:]+):\s*(.*)$/


export default class ssdp extends EventEmitter {
	private readonly multicast: string
	private readonly port: number

	private sockets: dgram.Socket[]
	private _destroyed: boolean
	private readonly _sourcePort: number
	private _bound: boolean
	private _queue: { query: Buffer, resolve: Function, reject: Function }[]
	private readonly response_timeout: number | 5000

	constructor(options?: {
		multicast_ip?: string | '239.255.255.250'
		multicast_port?: number | 1900
		source_port?: number | 0
		response_timeout?: number | 5000
	}) {
		super()

		options = Object.assign({
			multicast_ip: MULTICAST_IP_ADDRESS,
			multicast_port: MULTICAST_PORT,
			source_port: 0,
			response_timeout: RESPONSE_TIMEOUT,
		}, options)

		this.multicast = options.multicast_ip
		this.port = options.multicast_port

		this.response_timeout = options.response_timeout
		this._sourcePort = options.source_port
		this._destroyed = false
		this._bound = false
		this._queue = []

		this.sockets = []

		this.createSockets()
	}

	createSockets() {
		if (this._destroyed) throw new Error('client is destroyed')

		this.sockets = []

		const interfaces = os.networkInterfaces()

		for (const [, data] of Object.entries(interfaces)) {
			for (const item of data) {
				if (!item.internal && item.family === 'IPv4') this.sockets.push(this.createSocket(item))
			}
		}
	}

	createSocket(interf: NetworkInterfaceInfoIPv4 | NetworkInterfaceInfoIPv6) {
		let socket = dgram.createSocket(interf.family === 'IPv4' ? 'udp4' : 'udp6')

		socket.on('error', () => {
			if (socket) {
				socket.close()
			}
		})
		socket.on('close', () => {
			if (socket) {
				this.sockets.splice(this.sockets.indexOf(socket), 1)
				socket = null
			}
		})
		socket.on('listening', () => {
			this._bound = true
			this.ready()
		})

		socket.bind(this._sourcePort, interf.address)

		return socket
	}

	ready() {
		while (this._queue.length > 0) {
			let promises = []
			const {query, resolve} = this._queue.shift()
			for (const socket of this.sockets) {
				promises.push(new Promise((resolve1, reject1) => {
					// socket.on('error', reject1)
					socket.once('message', (data, rinfo) => {
						resolve1(this._parseResponse(data.toString(), rinfo, socket.address()))
					})
					setTimeout(reject1, this.response_timeout, 'timeout')
				}))
				socket.send(query, 0, query.length, this.port, this.multicast)
			}
			resolve(Promise.allSettled(promises))
		}
	}

	search(device: string) {
		return new Promise((resolve: (value: { status: 'fulfilled' | 'rejected', reason?: any, value: { rinfo: dgram.RemoteInfo, linfo: AddressInfo, headers: { [k: string]: string }, msg: string } }[]) => void, reject) => {
			if (this._destroyed) return reject(new Error('client is destroyed'))

			const query = Buffer.from(
				'M-SEARCH * HTTP/1.1\r\n' +
				'HOST: ' + this.multicast + ':' + this.port + '\r\n' +
				'MAN: "ssdp:discover"\r\n' +
				'MX: 1\r\n' +
				'ST: ' + device + '\r\n' +
				'\r\n'
			)

			this._queue.push({query, resolve, reject})
			if (this._bound) this.ready()
		})
	}

	_parseResponse(msg: string, rinfo: dgram.RemoteInfo, linfo: AddressInfo) {
		const {headers} = this._parseCommand(msg)
		return {rinfo, linfo, headers, msg}
	}

	_parseCommand(msg) {
		const method = this._getMethod(msg)
		const headers = this._getHeaders(msg)
		return {method, headers}
	}

	_getMethod(msg) {
		let lines = msg.split('\r\n')
		let type = lines.shift().split(' ')
		return (type[0] || '').toLowerCase()
	}

	_getHeaders(msg) {
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

	destroy() {
		this._destroyed = true

		while (this.sockets.length > 0) {
			const socket = this.sockets.shift()
			socket.close()
		}
	}
}
