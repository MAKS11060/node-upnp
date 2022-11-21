import {UPnP} from '../src/upnp.js'

const client = new UPnP({
	protocol: ['TCP'],
	ttl: 0,
})

await client.externalAddress().then(ip => {
	console.log('ip', ip)
	// client.destroy()
})

/*await client.getMapping({allClients: true}).then(value => {
	console.log(value)
})*/

/*await client.mapping({
	remotePort: 3000,
	protocol: 'TCP',
})*/

/*await client.unmapping({
	remotePort: 3000
})*/
