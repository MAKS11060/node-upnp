import UPnP from '../dist/upnp.js'

const c = UPnP.createClient()

await c.getMappings().then(value => {
	console.log('GetMappings', value)
})
