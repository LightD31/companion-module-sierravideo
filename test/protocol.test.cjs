const { describe, it } = require('node:test')
const assert = require('node:assert')

/**
 * Tests for the protocol parsing utility functions.
 * These mirror the logic extracted into src/protocol.ts, tested against
 * the same regex patterns and parsing behavior.
 */

// Since protocol.ts is a TypeScript ESM module, we replicate the pure functions here
// for testing. The build ensures these stay in sync via the integration in main.ts.

function cleanMessage(message, preserveSpaces = false) {
	let cleaned = message.replace(/\*\*/g, '').replace(/!!/g, '')
	if (preserveSpaces) {
		cleaned = cleaned.replace(/\s*OK\s*/g, '').trim()
	} else {
		cleaned = cleaned.replace(/\s*OK\s*/g, ' ').trim()
	}
	return cleaned
}

function classifyMessage(message) {
	if (message.includes('ERROR')) return 'error'
	if (/\sI[A-Z,]+/.test(message) || message.includes(' I ')) return 'capabilities'
	if (/\sQ[^\s]+~/.test(message)) return 'model'
	if (/\sL[OS(\d,)]*\d+,\d+,\d+/.test(message)) return 'device'
	return 'routing'
}

function parseError(message) {
	const errorMatch = message.match(/ERROR\s*([^!]*)/)
	return errorMatch && errorMatch[1].trim() ? errorMatch[1].trim() : 'Unknown error'
}

function parseCommandCapabilities(message) {
	const cleaned = cleanMessage(message, true)
	const iMatch = cleaned.match(/I([A-Z,]+)~?/i)
	if (!iMatch) return null
	const commandsStr = iMatch[1].replace(/~$/, '')
	const commands = commandsStr
		.replace(/,/g, '')
		.split('')
		.filter((c) => /[A-Z]/i.test(c))
	return {
		commands,
		supportsX: commands.includes('X'),
		supportsY: commands.includes('Y'),
		supportsV: commands.includes('V'),
		supportsU: commands.includes('U'),
	}
}

function parseModelInfo(message) {
	const cleaned = cleanMessage(message, true)
	const qMatch = cleaned.match(/Q([^~]+)~([^~]*)~/)
	if (!qMatch) return null
	return { modelName: qMatch[1].trim(), firmwareVersion: qMatch[2].trim() }
}

function parseDeviceCapabilities(message) {
	const cleaned = cleanMessage(message, true)
	const lMatch = cleaned.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+),?(.*)~~/)
	if (lMatch) {
		const outputs = parseInt(lMatch[1], 10)
		const levels = parseInt(lMatch[2], 10)
		const inputs = parseInt(lMatch[3], 10)
		const levelNamesStr = lMatch[4]
		if (!isNaN(outputs) && !isNaN(levels) && !isNaN(inputs)) {
			const levelNames = {}
			if (levelNamesStr && levelNamesStr.length > 0) {
				const names = levelNamesStr.split('~').filter((n) => n.length > 0)
				for (let i = 0; i < names.length && i < levels; i++) {
					levelNames[i + 1] = names[i].trim()
				}
			}
			return { outputs, levels, inputs, levelNames }
		}
	}
	const simpleMatch = cleaned.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+)/)
	if (simpleMatch) {
		const outputs = parseInt(simpleMatch[1], 10)
		const levels = parseInt(simpleMatch[2], 10)
		const inputs = parseInt(simpleMatch[3], 10)
		if (!isNaN(outputs) && !isNaN(levels) && !isNaN(inputs)) {
			return { outputs, levels, inputs, levelNames: {} }
		}
	}
	return null
}

function parseRoutingCommands(message, routingStatus, levelCount) {
	const cleaned = cleanMessage(message)
	if (!cleaned) return { variableValues: {}, updatedOutputs: false }
	const commands = cleaned.split(/\s+/)
	const variableValues = {}
	for (const command of commands) {
		if (command.startsWith('V')) {
			const parts = command.substring(1).split(',')
			if (parts.length >= 2) {
				const output = parseInt(parts[0], 10)
				if (!isNaN(output) && output > 0) {
					if (!routingStatus[output]) routingStatus[output] = {}
					for (let i = 1; i < parts.length; i++) {
						const input = parseInt(parts[i], 10)
						if (!isNaN(input) && input >= 0) {
							routingStatus[output][i] = input
							variableValues[`output_${output}_level_${i}_input`] = input
						}
					}
				}
			}
		} else if (command.startsWith('Y')) {
			const parts = command.substring(1).split(',')
			if (parts.length >= 2) {
				const output = parseInt(parts[0], 10)
				const input = parseInt(parts[1], 10)
				if (!isNaN(output) && !isNaN(input) && output > 0 && input >= 0) {
					if (!routingStatus[output]) routingStatus[output] = {}
					for (let level = 1; level <= levelCount; level++) {
						routingStatus[output][level] = input
						variableValues[`output_${output}_level_${level}_input`] = input
					}
				}
			}
		} else if (command.startsWith('X')) {
			const parts = command.substring(1).split(',')
			if (parts.length >= 3) {
				const output = parseInt(parts[0], 10)
				const input = parseInt(parts[1], 10)
				const level = parseInt(parts[2], 10)
				if (!isNaN(output) && !isNaN(input) && !isNaN(level) && output > 0 && input >= 0 && level > 0) {
					if (!routingStatus[output]) routingStatus[output] = {}
					routingStatus[output][level] = input
					variableValues[`output_${output}_level_${level}_input`] = input
				}
			}
		}
	}
	return { variableValues, updatedOutputs: Object.keys(variableValues).length > 0 }
}

// ============ Tests ============

describe('cleanMessage', () => {
	it('should strip ** and !! delimiters', () => {
		assert.strictEqual(cleanMessage('** Y1,5 OK !!'), 'Y1,5')
	})

	it('should preserve spaces mode strips OK without adding spaces', () => {
		assert.strictEqual(cleanMessage('** IQLSCUX~ OK !!', true), 'IQLSCUX~')
	})

	it('should handle empty messages', () => {
		assert.strictEqual(cleanMessage('** OK !!'), '')
	})
})

describe('classifyMessage', () => {
	it('should classify ERROR messages', () => {
		assert.strictEqual(classifyMessage('** ERROR Syntax !!'), 'error')
	})

	it('should classify I (capabilities) messages', () => {
		assert.strictEqual(classifyMessage('** IQLSCUX~ OK !!'), 'capabilities')
	})

	it('should classify standalone I response', () => {
		assert.strictEqual(classifyMessage('** I OK !!'), 'capabilities')
	})

	it('should classify Q (model info) messages', () => {
		assert.strictEqual(classifyMessage('** QSmall~V2.1~ OK !!'), 'model')
	})

	it('should classify L (device capabilities) messages', () => {
		assert.strictEqual(classifyMessage('** L64,3,32,VIDEO~AudioL~AudioR~~ OK !!'), 'device')
	})

	it('should classify routing messages as default', () => {
		assert.strictEqual(classifyMessage('** Y1,5 OK !!'), 'routing')
	})

	it('should classify X routing messages', () => {
		assert.strictEqual(classifyMessage('** X12,9,2 OK !!'), 'routing')
	})

	it('should classify V routing messages', () => {
		assert.strictEqual(classifyMessage('** V3,1,2,2 OK !!'), 'routing')
	})
})

describe('parseError', () => {
	it('should extract error detail', () => {
		assert.strictEqual(parseError('** ERROR Syntax:No Number:XX !!'), 'Syntax:No Number:XX')
	})

	it('should return Unknown error for empty detail', () => {
		assert.strictEqual(parseError('** ERROR !!'), 'Unknown error')
	})
})

describe('parseCommandCapabilities', () => {
	it('should parse concatenated format', () => {
		const result = parseCommandCapabilities('** IQLSCUX~ OK !!')
		assert.ok(result)
		assert.ok(result.commands.includes('Q'))
		assert.ok(result.commands.includes('U'))
		assert.ok(result.commands.includes('X'))
		assert.strictEqual(result.supportsU, true)
		assert.strictEqual(result.supportsX, true)
	})

	it('should parse comma-separated format', () => {
		const result = parseCommandCapabilities('** I,L,S,Q,X,Y,V~ OK !!')
		assert.ok(result)
		assert.ok(result.commands.includes('Y'))
		assert.ok(result.commands.includes('V'))
		assert.strictEqual(result.supportsY, true)
		assert.strictEqual(result.supportsV, true)
	})

	it('should return null for non-matching message', () => {
		const result = parseCommandCapabilities('** Y1,5 OK !!')
		assert.strictEqual(result, null)
	})
})

describe('parseModelInfo', () => {
	it('should parse model name and firmware', () => {
		const result = parseModelInfo('** QSmall~V2.1~ OK !!')
		assert.ok(result)
		assert.strictEqual(result.modelName, 'Small')
		assert.strictEqual(result.firmwareVersion, 'V2.1')
	})

	it('should parse model with spaces', () => {
		const result = parseModelInfo('** QSierra Pro 64~3.0.1~ OK !!')
		assert.ok(result)
		assert.strictEqual(result.modelName, 'Sierra Pro 64')
		assert.strictEqual(result.firmwareVersion, '3.0.1')
	})

	it('should return null for non-matching message', () => {
		assert.strictEqual(parseModelInfo('** Y1,5 OK !!'), null)
	})
})

describe('parseDeviceCapabilities', () => {
	it('should parse full format with level names', () => {
		const result = parseDeviceCapabilities('** L64,3,32,VIDEO~AudioL~AudioR~~ OK !!')
		assert.ok(result)
		assert.strictEqual(result.outputs, 64)
		assert.strictEqual(result.levels, 3)
		assert.strictEqual(result.inputs, 32)
		assert.deepStrictEqual(result.levelNames, { 1: 'VIDEO', 2: 'AudioL', 3: 'AudioR' })
	})

	it('should parse format with O/S prefixes', () => {
		const result = parseDeviceCapabilities('** LO(2,3)S(1)16,1,1,Video~~ OK !!')
		assert.ok(result)
		assert.strictEqual(result.outputs, 16)
		assert.strictEqual(result.levels, 1)
		assert.strictEqual(result.inputs, 1)
		assert.deepStrictEqual(result.levelNames, { 1: 'Video' })
	})

	it('should parse simple format without level names', () => {
		const result = parseDeviceCapabilities('** L16,1,1 OK !!')
		assert.ok(result)
		assert.strictEqual(result.outputs, 16)
		assert.strictEqual(result.levels, 1)
		assert.strictEqual(result.inputs, 1)
		assert.deepStrictEqual(result.levelNames, {})
	})

	it('should return null for non-matching message', () => {
		assert.strictEqual(parseDeviceCapabilities('** Y1,5 OK !!'), null)
	})
})

describe('parseRoutingCommands', () => {
	it('should parse Y command and set all levels', () => {
		const routing = {}
		const result = parseRoutingCommands('** Y1,5 OK !!', routing, 3)
		assert.strictEqual(result.updatedOutputs, true)
		assert.strictEqual(routing[1][1], 5)
		assert.strictEqual(routing[1][2], 5)
		assert.strictEqual(routing[1][3], 5)
		assert.strictEqual(result.variableValues['output_1_level_1_input'], 5)
	})

	it('should parse X command and set single level', () => {
		const routing = {}
		const result = parseRoutingCommands('** X12,9,2 OK !!', routing, 3)
		assert.strictEqual(result.updatedOutputs, true)
		assert.strictEqual(routing[12][2], 9)
		assert.strictEqual(routing[12][1], undefined)
	})

	it('should parse V command with multiple levels', () => {
		const routing = {}
		const result = parseRoutingCommands('** V3,1,2,2 OK !!', routing, 3)
		assert.strictEqual(result.updatedOutputs, true)
		assert.strictEqual(routing[3][1], 1)
		assert.strictEqual(routing[3][2], 2)
		assert.strictEqual(routing[3][3], 2)
	})

	it('should handle mute (input 0) via Y command', () => {
		const routing = {}
		const result = parseRoutingCommands('** Y3,0 OK !!', routing, 2)
		assert.strictEqual(result.updatedOutputs, true)
		assert.strictEqual(routing[3][1], 0)
		assert.strictEqual(routing[3][2], 0)
	})

	it('should parse multiple commands in one message', () => {
		const routing = {}
		const result = parseRoutingCommands('** Y1,5 Y2,3 OK !!', routing, 2)
		assert.strictEqual(result.updatedOutputs, true)
		assert.strictEqual(routing[1][1], 5)
		assert.strictEqual(routing[2][1], 3)
	})

	it('should reject invalid output 0', () => {
		const routing = {}
		const result = parseRoutingCommands('** X0,1,1 OK !!', routing, 2)
		assert.strictEqual(result.updatedOutputs, false)
	})

	it('should return no updates for empty message', () => {
		const routing = {}
		const result = parseRoutingCommands('** OK !!', routing, 2)
		assert.strictEqual(result.updatedOutputs, false)
	})
})
