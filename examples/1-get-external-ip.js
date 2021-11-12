import UPnP from '../dist/upnp.js'

const c = UPnP.createClient()

c.externalIp().then(r => {
	console.log(r)
})
