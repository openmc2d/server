import { GAMERULES, version } from '../config.js'
import { players } from '../world/index.js'
import { Dimensions } from '../world/index.js'
import { chat, LIGHT_GREY, ITALIC, prefix } from './chat.js'
import { MOD, OP } from '../config.js'
import { Entity } from '../entities/entity.js'
import { World } from '../world/world.js'
function log(who, msg){
	if(!GAMERULES.commandlogs)return
	chat(prefix(who, 1)+msg, LIGHT_GREY + ITALIC)
}
function selector(a, who){
	if(a[0] == '@'){
		if(a[1] == 's')return who instanceof Entity ? [who] : []
		if(a[1] == 'e')throw "@e unimplemented"
		const candidates = [...players.values()]
		if(!candidates.length)throw "No targets matched selector"
		if(a[1] == 'a')return candidates
		if(a[1] == 'p'){
			if(!who || who.clients)throw "No targets matched selector"
			const closest = candidates.winner(a => {
				if(a.world != who.world)return -Infinity
				const dx = a.x - who.x, dy = a.y - who.y
				return -(dx * dx + dy * dy)
			})
			return [closest]
		}
		if(a[1] == 'r')return candidates[Math.floor(Math.random() * candidates.length)]
	}else{
		const player = players.get(a)
		if(!player)throw "No targets matched selector"
		return [player]
	}
}
let stack = null
export function err(e){
	if(!e.stack)return e
	stack = e.stack
	return e + '\nType /stacktrace to view full stack trace'
}
export const commands = {
	list(){
		let a = "Online players"
		for(let pl of players.values())a += '\n' + pl.name + ' ('+pl.health+')'
		return a
	},
	say(s, ...l){
		if(this.permissions < MOD)throw 'You do not have permission to /say'
		if(!l.length)throw 'Command usage: /say <style> <text...>\nExample: /say lime-bold Hello!'
		let col = 0, txt = s.includes('raw') ? l.join(' ') : prefix(this, 1) + l.join(' ')
		for(let [m] of (s.match(/bold|italic|underline|strike/g)||[]))col |= (m > 'i' ? m == 'u' ? 64 : 128 : m == 'b' ? 16 : 32)
		col += s.match(/()black|()dark[-_]?red|()dark[-_]?green|()(?:gold|dark[-_]?yellow)|()dark[-_]?blue|()dark[-_]?purple|()dark[-_]?(?:aqua|cyan)|()(?:light[-_]?)?gr[ea]y|()dark[-_]?gr[ea]y|()red|()(?:green|lime)|()yellow|()blue|()purple|()(?:aqua|cyan)|$/).slice(1).indexOf('') & 15
		chat(txt, col)
	},
	tp(a, ax, ay, d = this.world || 'overworld'){
		if(!ay)ay=ax,ax=a,a='@s'
		if(this.permissions < MOD)throw 'You do not have permission to /tp'
		if(typeof d == 'string')d = Dimensions[d]
		if(!(d instanceof World))throw 'Invalid dimension'
		let x = ax, y = ay
		let players = selector(a, this)
    if(x[0] == "^" && y[0] == "^"){
			x = (+x.slice(1))/180*Math.PI - this.facing
			y = +y.slice(1);
			[x, y] = [this.x + Math.sin(x) * y, this.y + Math.cos(x) * y]
		}else{
			if(x[0] == "~")x = this.x + +x.slice(1)
			else x -= 0
			if(y[0] == "~")y = this.y + +y.slice(1)
			else y -= 0
		}
		for(let pl of players)pl.transport(x, y, d), pl.rubber()
		if(players.length>1)log(this, `Teleported ${players.length} entities`)
		else log(this, `Teleported ${players[0].name} to (${x}, ${y})`)
	},
	kick(a, ...r){
		if(this.permissions < MOD)throw 'You do not have permission to /kick players'
		const reason = r.join(' ')
		let players = selector(a, this)
		if(players.length > 1 && this.permissions < OP)throw 'Moderators may not kick more than 1 person at a time'
		for(const pl of players){
			pl.sock.send('-12fYou were kicked\n'+reason)
			pl.sock.close()
		}
	},
	give(sel, item, count = '1'){
		if(this.permissions < MOD)throw 'You do not have permission to /give items'
		let itm = Items[item], c = Math.max(count | 0, 0)
		if(!itm)throw 'No such item: '+item
		for(const player of selector(sel)){
			const stack = itm(c)
			player.give(stack)
			if(stack.count); //TODO: summon item entity
		}
	},
	help(c = 1){
		const cmds = this.permissions == MOD ? mod_help : this.permission == OP ? help : anyone_help
		if(c in cmds){
			return '/' + c + ' ' + cmds[c]
		}else{
			return 'Commands: '+Object.keys(cmds).join(', ')+'\n/help '+cmds.help
		}
	},
	stacktrace(){
		if(this.permission < OP)throw 'You do not have permission to view stack trace'
		if(!stack)return 'No stack trace found...'
		console.warn(stack)
		return stack
	},
	time(time, d = this.world || 'overworld'){
		if(this.permission < MOD)throw 'You do not have permission to change dimension time!'
		if(typeof d == 'string')d = Dimensions[d]
		if(!time){
			return `This dimension is on tick ${d.tick}\nThe day is ${Math.floor((d.tick + 7000) / 24000)} and the time is ${Math.floor((d.tick/1000+6)%24).toString().padStart(2,'0')}:${(Math.floor((d.tick/250)%4)*15).toString().padStart(2,'0')}`
		}else if(time[0] == '+' || time[0] == '-'){
			let t = d.tick + +time
			if(t < 0)t = (t % 24000 + 24000) % 24000
			if(t != t)throw `'${time}' is not a valid number`
			d.tick = t
			return 'Set the time to '+t
		}else if(time[0] >= '0' && time[0] <= '9'){
			const t = +time
			if(!(t >= 0))throw `'${time}' is not a valid number`
			d.tick = t
			return 'Set the time to '+t
		}
		let t;
		switch(time){
			case 'day': t = 1800; break
			case 'noon': t = 6000; break
			case 'afternoon': t = 9000; break
			case 'sunset': t = 13800; break
			case 'night': t = 15600; break
			case 'midnight': t = 18000; break
			case 'dark': t = 22000; break
			case 'sunrise': t = 0; break
			default:
			throw "'invalid option: '"+time+"'"
		}
		t = (d.tick - t) % 24000
		if(t >= 12000)d.tick += (24000 - t)
		else d.tick -= t
		return 'Set the time to '+time
	},
	info(){
		return `Vanilla server software ${version}\n`
	}
}

//Aliases
commands.i = commands.info

export const anyone_help = {
	help: '<cmd> -- Help for a command',
	list: '-- List online players'
}, mod_help = {
	...anyone_help,
	kick: '[player] -- Kick a player',
	say: '[style] [msg] -- Send a message in chat',
	tp: '[player] [x] [y] (dimension) -- teleport someone to a dimension'
}, help = {
	...mod_help,
}
Object.setPrototypeOf(anyone_help, null)
Object.setPrototypeOf(mod_help, null)
Object.setPrototypeOf(help, null)