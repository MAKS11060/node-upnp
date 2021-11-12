import UPnP from '../dist/upnp.js'

const c = UPnP.createClient()

await c.portMapping({
	//host: '', // local host
	port: 8000, // local port
	protocol: 'TCP', // 'UDP'
}).then(value => {
	console.log(value)
})