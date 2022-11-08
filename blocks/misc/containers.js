import { Block, Blocks } from '../block.js'
import { Item } from '../../items/item.js'

Blocks.chest = Block.define({
	tool: 'axe',
	slots: 27,
}, {
	items: [Item,27],
	name: String
})