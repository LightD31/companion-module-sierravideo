const { describe, it } = require('node:test')
const assert = require('node:assert')

/**
 * Tests for Sierra Video Protocol parsing logic.
 * These test the same regex patterns and parsing logic used in src/main.ts.
 */

describe('Protocol Message Parsing', () => {
	describe('Y command (all levels routing)', () => {
		it('should parse Y response and update routing for all levels', () => {
			const routingStatus = {}
			const message = '** Y1,5 OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, ' ')
				.trim()
			const commands = cleanedMessage.split(/\s+/)
			const variableValues = {}

			for (const command of commands) {
				if (command.startsWith('Y')) {
					const parts = command.substring(1).split(',')
					if (parts.length >= 2) {
						const output = parseInt(parts[0], 10)
						const input = parseInt(parts[1], 10)
						if (!isNaN(output) && !isNaN(input) && output > 0 && input >= 0) {
							if (!routingStatus[output]) routingStatus[output] = {}
							for (let level = 1; level <= 3; level++) {
								routingStatus[output][level] = input
								variableValues[`output_${output}_level_${level}_input`] = input
							}
						}
					}
				}
			}

			assert.strictEqual(routingStatus[1][1], 5)
			assert.strictEqual(routingStatus[1][2], 5)
			assert.strictEqual(routingStatus[1][3], 5)
			assert.strictEqual(variableValues['output_1_level_1_input'], 5)
		})

		it('should handle mute (input 0)', () => {
			const routingStatus = {}
			const command = 'Y3,0'
			const parts = command.substring(1).split(',')
			const output = parseInt(parts[0], 10)
			const input = parseInt(parts[1], 10)

			routingStatus[output] = {}
			for (let level = 1; level <= 2; level++) {
				routingStatus[output][level] = input
			}

			assert.strictEqual(routingStatus[3][1], 0)
			assert.strictEqual(routingStatus[3][2], 0)
		})
	})

	describe('X command (single level routing)', () => {
		it('should parse X response and update single level', () => {
			const routingStatus = {}
			const command = 'X12,9,2'
			const parts = command.substring(1).split(',')
			const output = parseInt(parts[0], 10)
			const input = parseInt(parts[1], 10)
			const level = parseInt(parts[2], 10)

			routingStatus[output] = {}
			routingStatus[output][level] = input

			assert.strictEqual(routingStatus[12][2], 9)
		})

		it('should reject invalid values', () => {
			const command = 'X0,1,1' // output 0 is invalid
			const parts = command.substring(1).split(',')
			const output = parseInt(parts[0], 10)
			const input = parseInt(parts[1], 10)
			const level = parseInt(parts[2], 10)

			const isValid = !isNaN(output) && !isNaN(input) && !isNaN(level) && output > 0 && input >= 0 && level > 0
			assert.strictEqual(isValid, false)
		})
	})

	describe('V command (multi-level routing)', () => {
		it('should parse V response with multiple levels', () => {
			const routingStatus = {}
			const command = 'V3,1,2,2'
			const parts = command.substring(1).split(',')
			const output = parseInt(parts[0], 10)

			if (!isNaN(output) && output > 0) {
				routingStatus[output] = {}
				for (let i = 1; i < parts.length; i++) {
					const input = parseInt(parts[i], 10)
					const level = i
					if (!isNaN(input) && input >= 0) {
						routingStatus[output][level] = input
					}
				}
			}

			assert.strictEqual(routingStatus[3][1], 1)
			assert.strictEqual(routingStatus[3][2], 2)
			assert.strictEqual(routingStatus[3][3], 2)
		})
	})

	describe('I command (supported commands)', () => {
		it('should parse command capabilities', () => {
			const message = '** IQLSCUX~ OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const iMatch = cleanedMessage.match(/I([A-Z,]+)~?/i)

			assert.ok(iMatch)
			const commandsStr = iMatch[1].replace(/~$/, '')
			const commands = commandsStr
				.replace(/,/g, '')
				.split('')
				.filter((c) => /[A-Z]/i.test(c))

			assert.ok(commands.includes('Q'))
			assert.ok(commands.includes('L'))
			assert.ok(commands.includes('S'))
			assert.ok(commands.includes('C'))
			assert.ok(commands.includes('U'))
			assert.ok(commands.includes('X'))
		})

		it('should parse comma-separated format', () => {
			const message = '** I,L,S,Q,X,Y,V~ OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const iMatch = cleanedMessage.match(/I([A-Z,]+)~?/i)

			assert.ok(iMatch)
			const commandsStr = iMatch[1].replace(/~$/, '')
			const commands = commandsStr
				.replace(/,/g, '')
				.split('')
				.filter((c) => /[A-Z]/i.test(c))

			assert.ok(commands.includes('L'))
			assert.ok(commands.includes('Y'))
			assert.ok(commands.includes('V'))
		})
	})

	describe('Q command (model info)', () => {
		it('should parse model name and firmware version', () => {
			const message = '** QSmall~V2.1~ OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const qMatch = cleanedMessage.match(/Q([^~]+)~([^~]*)~/)

			assert.ok(qMatch)
			assert.strictEqual(qMatch[1].trim(), 'Small')
			assert.strictEqual(qMatch[2].trim(), 'V2.1')
		})
	})

	describe('L command (device capabilities)', () => {
		it('should parse device capabilities with level names', () => {
			const message = '** L64,3,32,VIDEO~AudioL~AudioR~~ OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const lMatch = cleanedMessage.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+),?(.*)~~/)

			assert.ok(lMatch)
			assert.strictEqual(parseInt(lMatch[1], 10), 64)
			assert.strictEqual(parseInt(lMatch[2], 10), 3)
			assert.strictEqual(parseInt(lMatch[3], 10), 32)

			const levelNames = lMatch[4].split('~').filter((n) => n.length > 0)
			assert.deepStrictEqual(levelNames, ['VIDEO', 'AudioL', 'AudioR'])
		})

		it('should parse capabilities with O/S prefixes', () => {
			const message = '** LO(2,3)S(1)16,1,1,Video~~ OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const lMatch = cleanedMessage.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+),?(.*)~~/)

			assert.ok(lMatch)
			assert.strictEqual(parseInt(lMatch[1], 10), 16)
			assert.strictEqual(parseInt(lMatch[2], 10), 1)
			assert.strictEqual(parseInt(lMatch[3], 10), 1)

			const levelNames = lMatch[4].split('~').filter((n) => n.length > 0)
			assert.deepStrictEqual(levelNames, ['Video'])
		})

		it('should parse simple format without level names', () => {
			const message = '** L16,1,1 OK !!'
			const cleanedMessage = message
				.replace(/\*\*/g, '')
				.replace(/!!/g, '')
				.replace(/\s*OK\s*/g, '')
				.trim()
			const simpleMatch = cleanedMessage.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+)/)

			assert.ok(simpleMatch)
			assert.strictEqual(parseInt(simpleMatch[1], 10), 16)
			assert.strictEqual(parseInt(simpleMatch[2], 10), 1)
			assert.strictEqual(parseInt(simpleMatch[3], 10), 1)
		})
	})

	describe('Error response handling', () => {
		it('should detect ERROR in messages', () => {
			const message = '** ERROR Syntax:No Number:XX !!'
			assert.ok(message.includes('ERROR'))

			const errorMatch = message.match(/ERROR\s*([^!]*)/)
			assert.ok(errorMatch)
			assert.ok(errorMatch[1].trim().length > 0)
		})
	})

	describe('Buffer processing', () => {
		it('should split multiple messages on !! delimiter', () => {
			const data = '** Y1,5 OK !!** Y2,3 OK !!'
			let buffer = data
			const messages = []

			while (buffer.includes('!!')) {
				const endIndex = buffer.indexOf('!!') + 2
				messages.push(buffer.substring(0, endIndex))
				buffer = buffer.substring(endIndex)
			}

			assert.strictEqual(messages.length, 2)
			assert.ok(messages[0].includes('Y1,5'))
			assert.ok(messages[1].includes('Y2,3'))
		})

		it('should handle partial messages by keeping buffer', () => {
			const data = '** Y1,5 OK !!** Y2,'
			let buffer = data
			const messages = []

			while (buffer.includes('!!')) {
				const endIndex = buffer.indexOf('!!') + 2
				messages.push(buffer.substring(0, endIndex))
				buffer = buffer.substring(endIndex)
			}

			assert.strictEqual(messages.length, 1)
			assert.ok(messages[0].includes('Y1,5'))
			assert.strictEqual(buffer, '** Y2,')
		})

		it('should truncate overflow buffer to last message boundary', () => {
			let buffer = 'A'.repeat(9990) + '!!partial data here'
			if (buffer.length > 10000) {
				const lastDelimiter = buffer.lastIndexOf('!!')
				if (lastDelimiter >= 0) {
					buffer = buffer.substring(lastDelimiter + 2)
				} else {
					buffer = ''
				}
			}

			assert.strictEqual(buffer, 'partial data here')
		})

		it('should clear buffer if no delimiter found during overflow', () => {
			let buffer = 'A'.repeat(10001)
			if (buffer.length > 10000) {
				const lastDelimiter = buffer.lastIndexOf('!!')
				if (lastDelimiter >= 0) {
					buffer = buffer.substring(lastDelimiter + 2)
				} else {
					buffer = ''
				}
			}

			assert.strictEqual(buffer, '')
		})
	})

	describe('Command building', () => {
		it('should format Y command correctly', () => {
			const output = 1
			const input = 5
			const cmd = `**Y${output},${input}!!`
			assert.strictEqual(cmd, '**Y1,5!!')
		})

		it('should format X command correctly', () => {
			const output = 12
			const input = 9
			const level = 2
			const cmd = `**X${output},${input},${level}!!`
			assert.strictEqual(cmd, '**X12,9,2!!')
		})

		it('should format V command correctly', () => {
			const output = 3
			const inputs = '1,2,2'
			const cmd = `**V${output},${inputs}!!`
			assert.strictEqual(cmd, '**V3,1,2,2!!')
		})

		it('should format mute command (input 0)', () => {
			const output = 4
			const cmd = `**Y${output},0!!`
			assert.strictEqual(cmd, '**Y4,0!!')
		})
	})
})
