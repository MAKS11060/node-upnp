import UPnP from '../dist/upnp.js'

const c = UPnP.createClient()

await c.portMapping({
	protocol: 'TCP', // 'UDP'
	description: 'node-upnp',
	internal: {
		port: 8000, // local port
		//host: '192.168.100.2' // Your machine ip // auto detected
	},
	remote: {
		//port: // Default port from internal
		//port: 8000, // public port
	},
	ttl: 300,
	enabled: false
}).then(value => {
	console.log(value)
})