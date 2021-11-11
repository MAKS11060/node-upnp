import xml2js from 'xml2js'
import url from 'url'
import fetch from 'node-fetch'

export default class Device {
	private readonly url: string
	private readonly services: string[]

	constructor(url) {
		this.url = url
		this.services = [
			'urn:schemas-upnp-org:service:WANIPConnection:1',
			'urn:schemas-upnp-org:service:WANIPConnection:2',
			'urn:schemas-upnp-org:service:WANPPPConnection:1'
		]
	}

	async run(action: string, args: any[]) {
		const info = await this._getService(this.services)
		const body = [
			'<?xml version="1.0"?>',
			'<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ',
			's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
			'<s:Body>',
			`<u:${action} xmlns:u=${JSON.stringify(info.service)}>`,
			args.map(args => `<${args[0]}>` + (args[1] !== undefined ? args[1] : '') + `</${args[0]}>`).join(''),
			`</u:${action}>`,
			'</s:Body>',
			'</s:Envelope>'
		].join('')
		const res = await fetch(info.controlURL, {
			method: 'POST',
			headers: {
				'Content-Type': 'text/xml; charset="utf-8"',
				'Content-Length': `${Buffer.byteLength(body)}`,
				Connection: 'close',
				SOAPAction: JSON.stringify(`${info.service}#${action}`)
			},
			body
		})

		const data = await xml2js.parseStringPromise(await res.text(), xml2js.defaults['0.1'])

		const soapns = this._getNamespace(data, 'http://schemas.xmlsoap.org/soap/envelope/')
		if (res.status !== 200) {
			const {faultstring, detail} = data[`${soapns}Body`][`${soapns}Fault`]
			const {errorCode, errorDescription} = detail[faultstring]
			const err = new Error(errorDescription)
			err['code'] = errorCode
			throw err
		}

		return data[`${soapns}Body`]
	}

	async _getService(types) {
		const info = await this._getXml(this.url)
		const s = this._parseDescription(info).services.filter(service => types.indexOf(service.serviceType) !== -1)
		// Use the first available service
		if (s.length === 0 || !s[0].controlURL || !s[0].SCPDURL) {
			throw new Error('Service not found')
		}
		const base = new URL(info.baseURL || this.url)

		function addPrefix(u) {
			let uri
			try {
				uri = new URL(u)
			} catch (err) {
				// Is only the path of the URL
				uri = new URL(u, base.href)
			}
			uri.host = uri.host || base.host
			uri.protocol = uri.protocol || base.protocol
			return url.format(uri)
		}

		return {
			service: s[0].serviceType,
			SCPDURL: addPrefix(s[0].SCPDURL),
			controlURL: addPrefix(s[0].controlURL)
		}
		}

	async _getXml(url) {
		const res = await fetch(url)
		const value = await res.text()
		return await xml2js.parseStringPromise(value, xml2js.defaults['0.1'])
	}

	_parseDescription(info) {
		const services = []
		const devices = []

		const toArray = item => Array.isArray(item) ? item : [item]

		const traverseServices = service => service ? services.push(service) : null

		/*const traverseServices = service => {
			if (!service) return
			services.push(service)
		}*/

		function traverseDevices(device) {
			if (!device) return
			devices.push(device)

			if (device.deviceList && device.deviceList.device) {
				toArray(device.deviceList.device).forEach(traverseDevices)
			}

			if (device.serviceList && device.serviceList.service) {
				toArray(device.serviceList.service).forEach(traverseServices)
			}
		}

		traverseDevices(info.device)

		return {services, devices}
	}

	_getNamespace(data, uri) {
		let ns

		if (data['@']) {
			Object.keys(data['@']).some(key => {
				if (!/^xmlns:/.test(key)) return
				if (data['@'][key] !== uri) return

				ns = key.replace(/^xmlns:/, '')
				return true
			})
		}

		return ns ? ns + ':' : ''
	}
}