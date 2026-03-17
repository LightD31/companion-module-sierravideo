import type {
	CompanionActionDefinitions,
	CompanionInputFieldDropdown,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { getInputChoices, getOutputChoices, getLevelChoices } from './choices.js'

export function UpdateActions(self: ModuleInstance): void {
	const inputChoicesWithMute = getInputChoices(self, true)
	const outputChoices = getOutputChoices(self)
	const levelChoices = getLevelChoices(self)

	const actions: CompanionActionDefinitions = {
		route: {
			name: 'Route (All Levels)',
			description: 'Route an input to an output on all levels (AFV)',
			options: [
				{
					id: 'input',
					type: 'dropdown',
					label: 'Input',
					default: 1,
					choices: inputChoicesWithMute,
					tooltip: 'Select the source input to route. "Mute" sends input 0 to mute the output.',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'Select the destination output',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: async (action) => {
				try {
					const output = parseInt(String(action.options.output), 10)
					const input = parseInt(String(action.options.input), 10)
					if (!isNaN(output) && !isNaN(input)) {
						self.sendCommand(`Y${output},${input}`)
					}
				} catch (e) {
					self.log('error', `Route action failed: ${(e as Error).message}`)
				}
			},
		},

		routeLevel: {
			name: 'Route (Single Level)',
			description: 'Route an input to an output on a specific level',
			options: [
				{
					id: 'input',
					type: 'dropdown',
					label: 'Input',
					default: 1,
					choices: inputChoicesWithMute,
					tooltip: 'Select the source input to route. "Mute" sends input 0 to mute the output.',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'Select the destination output',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 1,
					choices: levelChoices,
					tooltip: 'Select the routing level (e.g., Video, Audio)',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: async (action) => {
				try {
					const output = parseInt(String(action.options.output), 10)
					const input = parseInt(String(action.options.input), 10)
					const level = parseInt(String(action.options.level), 10)
					if (!isNaN(output) && !isNaN(input) && !isNaN(level)) {
						self.sendCommand(`X${output},${input},${level}`)
					}
				} catch (e) {
					self.log('error', `Route level action failed: ${(e as Error).message}`)
				}
			},
		},

		muteOutput: {
			name: 'Mute Output',
			description: 'Mute an output (route input 0)',
			options: [
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'Select the output to mute',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: async (action) => {
				try {
					const output = parseInt(String(action.options.output), 10)
					if (!isNaN(output)) {
						self.sendCommand(`Y${output},0`)
					}
				} catch (e) {
					self.log('error', `Mute output action failed: ${(e as Error).message}`)
				}
			},
		},

		muteOutputLevel: {
			name: 'Mute Output on Level',
			description: 'Mute an output on a specific level (route input 0)',
			options: [
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'Select the output to mute',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 1,
					choices: levelChoices,
					tooltip: 'Select the routing level (e.g., Video, Audio)',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: async (action) => {
				try {
					const output = parseInt(String(action.options.output), 10)
					const level = parseInt(String(action.options.level), 10)
					if (!isNaN(output) && !isNaN(level)) {
						self.sendCommand(`X${output},0,${level}`)
					}
				} catch (e) {
					self.log('error', `Mute output level action failed: ${(e as Error).message}`)
				}
			},
		},

		routeMultiLevel: {
			name: 'Route (Multiple Levels)',
			description:
				'Route different inputs to an output on each level using V command (e.g., different video and audio sources)',
			options: [
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'Select the destination output',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'inputs',
					type: 'textinput',
					label: 'Inputs per Level (comma-separated, e.g., "1,2,2" for input 1 on level 1, input 2 on levels 2 and 3)',
					default: '1,1',
					useVariables: true,
					tooltip: 'Comma-separated list of input numbers, one per level. Use 0 to mute a level.',
				} satisfies CompanionInputFieldTextInput,
			],
			callback: async (action, context) => {
				try {
					const output = parseInt(String(action.options.output), 10)
					const inputsStr = await context.parseVariablesInString(String(action.options.inputs))
					if (!isNaN(output) && inputsStr) {
						self.sendCommand(`V${output},${inputsStr}`)
					}
				} catch (e) {
					self.log('error', `Route multi-level action failed: ${(e as Error).message}`)
				}
			},
		},

		queryStatus: {
			name: 'Query Routing Status',
			description: 'Request current routing status from the router',
			options: [],
			callback: async () => {
				self.queryStatus()
			},
		},

		queryDeviceInfo: {
			name: 'Query Device Info',
			description: 'Query device model, version, capabilities, and supported commands',
			options: [],
			callback: async () => {
				self.sendCommand('I')
				setTimeout(() => self.sendCommand('Q'), 200)
				setTimeout(() => self.sendCommand('L'), 400)
			},
		},

		setAutoReports: {
			name: 'Set Automatic Reports',
			description: 'Enable or disable automatic output change reports (U command)',
			options: [
				{
					id: 'enable',
					type: 'dropdown',
					label: 'Mode',
					default: 'on',
					choices: [
						{ id: 'on', label: 'Enable Automatic Reports' },
						{ id: 'off', label: 'Disable (Use Polling)' },
					],
				} satisfies CompanionInputFieldDropdown,
			],
			callback: async (action) => {
				if (action.options.enable === 'on') {
					self.enableAutomaticReports()
				} else {
					self.disableAutomaticReports()
				}
			},
		},

		sendCustomCommand: {
			name: 'Send Custom Command',
			description: 'Send a custom Sierra protocol command (without ** and !! delimiters)',
			options: [
				{
					id: 'command',
					type: 'textinput',
					label: 'Command',
					default: '',
					useVariables: true,
				} satisfies CompanionInputFieldTextInput,
			],
			callback: async (action, context) => {
				try {
					const command = await context.parseVariablesInString(String(action.options.command))
					if (command) {
						self.sendCommand(command)
					}
				} catch (e) {
					self.log('error', `Send custom command action failed: ${(e as Error).message}`)
				}
			},
		},
	}

	self.setActionDefinitions(actions)
}
