import { combineRgb } from '@companion-module/base'
import type { CompanionFeedbackDefinitions, CompanionInputFieldDropdown } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { getInputChoices, getOutputChoices, getLevelChoices } from './choices.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const inputChoices = getInputChoices(self)
	const outputChoices = getOutputChoices(self)
	const levelChoices = getLevelChoices(self)

	const feedbacks: CompanionFeedbackDefinitions = {
		routeStatus: {
			name: 'Route Active',
			description: 'Change button style when a specific input is routed to an output on a level',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 204, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'input',
					type: 'dropdown',
					label: 'Input',
					default: 1,
					choices: inputChoices,
					tooltip: 'The source input to check',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'The destination output to check',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 1,
					choices: levelChoices,
					tooltip: 'The routing level to check (e.g., Video, Audio)',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: (feedback) => {
				const output = parseInt(String(feedback.options.output), 10)
				const input = parseInt(String(feedback.options.input), 10)
				const level = parseInt(String(feedback.options.level), 10)
				return self.isRouteActive(output, input, level)
			},
		},

		outputMuted: {
			name: 'Output Muted',
			description: 'Change button style when an output is muted (input 0)',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'output',
					type: 'dropdown',
					label: 'Output',
					default: 1,
					choices: outputChoices,
					tooltip: 'The output to check for mute status',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 1,
					choices: levelChoices,
					tooltip: 'The routing level to check (e.g., Video, Audio)',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: (feedback) => {
				const output = parseInt(String(feedback.options.output), 10)
				const level = parseInt(String(feedback.options.level), 10)
				return self.isRouteActive(output, 0, level)
			},
		},

		inputRouted: {
			name: 'Input Routed Anywhere',
			description: 'Change button style when an input is routed to any output on a specific level',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 102, 204),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'input',
					type: 'dropdown',
					label: 'Input',
					default: 1,
					choices: inputChoices,
					tooltip: 'The source input to check',
				} satisfies CompanionInputFieldDropdown,
				{
					id: 'level',
					type: 'dropdown',
					label: 'Level',
					default: 1,
					choices: levelChoices,
					tooltip: 'The routing level to check (e.g., Video, Audio)',
				} satisfies CompanionInputFieldDropdown,
			],
			callback: (feedback) => {
				const input = parseInt(String(feedback.options.input), 10)
				const level = parseInt(String(feedback.options.level), 10)

				for (const outputKey of Object.keys(self.routingStatus)) {
					if (self.routingStatus[Number(outputKey)]?.[level] === input) {
						return true
					}
				}
				return false
			},
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
