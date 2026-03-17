import type { CompanionVariableValues } from '@companion-module/base'
import type { RoutingStatus } from './config.js'

/** Result of parsing a routing response message */
export interface RoutingParseResult {
	variableValues: CompanionVariableValues
	updatedOutputs: boolean
}

/** Result of parsing an I (command capabilities) response */
export interface CommandCapabilitiesResult {
	commands: string[]
	supportsX: boolean
	supportsY: boolean
	supportsV: boolean
	supportsU: boolean
}

/** Result of parsing a Q (model info) response */
export interface ModelInfoResult {
	modelName: string
	firmwareVersion: string
}

/** Result of parsing an L (device capabilities) response */
export interface DeviceCapabilitiesResult {
	outputs: number
	levels: number
	inputs: number
	levelNames: Record<number, string>
}

/**
 * Remove Sierra Video Protocol delimiters and status markers from a raw message.
 * Strips `**`, `!!`, and `OK` markers, then trims whitespace.
 */
export function cleanMessage(message: string, preserveSpaces = false): string {
	let cleaned = message.replace(/\*\*/g, '').replace(/!!/g, '')
	if (preserveSpaces) {
		cleaned = cleaned.replace(/\s*OK\s*/g, '').trim()
	} else {
		cleaned = cleaned.replace(/\s*OK\s*/g, ' ').trim()
	}
	return cleaned
}

/**
 * Determine the type of a Sierra Video Protocol response message.
 *
 * Detection patterns:
 * - ERROR: message contains the literal string "ERROR"
 * - I (capabilities): matches `\sI[A-Z,]+` (space + I + uppercase letters/commas)
 *   or contains ` I ` (standalone I response)
 * - Q (model info): matches `\sQ[^\s]+~` (space + Q + non-space chars + tilde delimiter)
 * - L (device caps): matches `\sL[OS(\d,)]*\d+,\d+,\d+` (space + L + optional O/S prefixes
 *   with parenthesized number lists + three comma-separated numbers for outputs,levels,inputs)
 * - routing: anything else (Y, X, V commands or status responses)
 */
export function classifyMessage(message: string): 'error' | 'capabilities' | 'model' | 'device' | 'routing' {
	if (message.includes('ERROR')) {
		return 'error'
	}

	// Match I command response: space + I + one or more uppercase letters/commas
	if (/\sI[A-Z,]+/.test(message) || message.includes(' I ')) {
		return 'capabilities'
	}

	// Match Q command response: space + Q + non-whitespace chars + tilde (level name delimiter)
	if (/\sQ[^\s]+~/.test(message)) {
		return 'model'
	}

	// Match L command response: space + L + optional O(nums)/S(nums) prefixes +
	// three comma-separated numbers (outputs, levels, inputs)
	if (/\sL[OS(\d,)]*\d+,\d+,\d+/.test(message)) {
		return 'device'
	}

	return 'routing'
}

/**
 * Parse an error response message. Extracts the error detail text after "ERROR".
 */
export function parseError(message: string): string {
	const errorMatch = message.match(/ERROR\s*([^!]*)/)
	return errorMatch && errorMatch[1].trim() ? errorMatch[1].trim() : 'Unknown error'
}

/**
 * Parse an I (command capabilities) response.
 *
 * The I response format is: `I<commands>~` where commands are either
 * concatenated uppercase letters (e.g., `IQLSCUX~`) or comma-separated
 * (e.g., `I,L,S,Q,X,Y,V~`).
 */
export function parseCommandCapabilities(message: string): CommandCapabilitiesResult | null {
	const cleaned = cleanMessage(message, true)

	// Match I followed by uppercase letters and/or commas, optionally ending with ~
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

/**
 * Parse a Q (model info) response.
 *
 * The Q response format is: `Q<model>~<firmware>~`
 * where tilde `~` separates the model name from the firmware version.
 */
export function parseModelInfo(message: string): ModelInfoResult | null {
	const cleaned = cleanMessage(message, true)

	// Match Q + model name (up to ~) + firmware version (up to ~)
	const qMatch = cleaned.match(/Q([^~]+)~([^~]*)~/)
	if (!qMatch) return null

	return {
		modelName: qMatch[1].trim(),
		firmwareVersion: qMatch[2].trim(),
	}
}

/**
 * Parse an L (device capabilities) response.
 *
 * Full format with level names:
 *   `L[O(n,n)][S(n,n)]<outputs>,<levels>,<inputs>,<name1>~<name2>~...~~`
 *
 * The regex `L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+),?(.*)~~` matches:
 *   - `L` literal
 *   - `(?:[OS](?:\(\d+(?:,\d+)*\))?)*` — zero or more O/S prefixes with optional
 *     parenthesized comma-separated number lists (e.g., `O(2,3)S(1)`)
 *   - `(\d+),(\d+),(\d+)` — three capture groups for outputs, levels, inputs
 *   - `,?(.*)~~` — optional comma + level names (tilde-separated) + double-tilde terminator
 *
 * Simpler format (no level names):
 *   `L[O(n,n)][S(n,n)]<outputs>,<levels>,<inputs>`
 */
export function parseDeviceCapabilities(message: string): DeviceCapabilitiesResult | null {
	const cleaned = cleanMessage(message, true)

	// Try full format with level names first (double-tilde terminated)
	const lMatch = cleaned.match(/L(?:[OS](?:\(\d+(?:,\d+)*\))?)*(\d+),(\d+),(\d+),?(.*)~~/)

	if (lMatch) {
		const outputs = parseInt(lMatch[1], 10)
		const levels = parseInt(lMatch[2], 10)
		const inputs = parseInt(lMatch[3], 10)
		const levelNamesStr = lMatch[4]

		if (!isNaN(outputs) && !isNaN(levels) && !isNaN(inputs)) {
			const levelNames: Record<number, string> = {}
			if (levelNamesStr && levelNamesStr.length > 0) {
				const names = levelNamesStr.split('~').filter((n) => n.length > 0)
				for (let i = 0; i < names.length && i < levels; i++) {
					levelNames[i + 1] = names[i].trim()
				}
			}

			return { outputs, levels, inputs, levelNames }
		}
	}

	// Fallback: simpler format without level names
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

/**
 * Parse routing status commands (Y, X, V) from a cleaned message.
 *
 * Command formats:
 * - `Y<out>,<in>` — route input to output on ALL levels
 * - `X<out>,<in>,<lvl>` — route input to output on a SINGLE level
 * - `V<out>,<in1>,<in2>,...` — route different inputs per level to one output
 */
export function parseRoutingCommands(
	message: string,
	routingStatus: RoutingStatus,
	levelCount: number,
): RoutingParseResult {
	const cleaned = cleanMessage(message)
	if (!cleaned) return { variableValues: {}, updatedOutputs: false }

	const commands = cleaned.split(/\s+/)
	const variableValues: CompanionVariableValues = {}

	for (const command of commands) {
		if (command.startsWith('V')) {
			const parts = command.substring(1).split(',')
			if (parts.length >= 2) {
				const output = parseInt(parts[0], 10)
				if (!isNaN(output) && output > 0) {
					if (!routingStatus[output]) {
						routingStatus[output] = {}
					}
					for (let i = 1; i < parts.length; i++) {
						const input = parseInt(parts[i], 10)
						const level = i
						if (!isNaN(input) && input >= 0) {
							routingStatus[output][level] = input
							variableValues[`output_${output}_level_${level}_input`] = input
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
					if (!routingStatus[output]) {
						routingStatus[output] = {}
					}
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
					if (!routingStatus[output]) {
						routingStatus[output] = {}
					}
					routingStatus[output][level] = input
					variableValues[`output_${output}_level_${level}_input`] = input
				}
			}
		}
	}

	return {
		variableValues,
		updatedOutputs: Object.keys(variableValues).length > 0,
	}
}
