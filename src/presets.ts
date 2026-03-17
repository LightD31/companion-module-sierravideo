import { combineRgb } from '@companion-module/base'
import type { CompanionPresetDefinitions, CompanionButtonPresetDefinition } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}
	const inputCount = self.getInputCount()
	const outputCount = self.getOutputCount()
	const levelCount = self.getLevelCount()

	const padInput = (n: number) => String(n).padStart(String(inputCount).length, '0')
	const padOutput = (n: number) => String(n).padStart(String(outputCount).length, '0')
	const padLevel = (n: number) => String(n).padStart(String(levelCount).length, '0')

	// Route presets: one category per output, one button per input
	for (let output = 1; output <= outputCount; output++) {
		for (let input = 1; input <= inputCount; input++) {
			presets[`route_${padInput(input)}_to_${padOutput(output)}`] = {
				type: 'button',
				category: `Output ${padOutput(output)}`,
				name: `Route In ${padInput(input)} → Out ${padOutput(output)}`,
				style: {
					text: `In ${padInput(input)}\\nOut ${padOutput(output)}`,
					size: 'auto',
					color: combineRgb(255, 255, 255),
					bgcolor: combineRgb(0, 0, 0),
				},
				steps: [
					{
						down: [
							{
								actionId: 'route',
								options: {
									input: input,
									output: output,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'routeStatus',
						options: {
							input: input,
							output: output,
							level: 1,
						},
						style: {
							bgcolor: combineRgb(0, 204, 0),
							color: combineRgb(255, 255, 255),
						},
					},
				],
			} satisfies CompanionButtonPresetDefinition
		}

		// Mute preset for each output
		presets[`mute_output_${padOutput(output)}`] = {
			type: 'button',
			category: `Output ${padOutput(output)}`,
			name: `Mute Output ${padOutput(output)}`,
			style: {
				text: `MUTE\\nOut ${padOutput(output)}`,
				size: 'auto',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(102, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'muteOutput',
							options: {
								output: output,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'outputMuted',
					options: {
						output: output,
						level: 1,
					},
					style: {
						bgcolor: combineRgb(255, 0, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		} satisfies CompanionButtonPresetDefinition
	}

	// Per-level route presets when the router has more than one level
	if (levelCount > 1) {
		for (let level = 1; level <= levelCount; level++) {
			const levelName = self.getLevelName(level)
			for (let output = 1; output <= outputCount; output++) {
				for (let input = 1; input <= inputCount; input++) {
					presets[`route_${padInput(input)}_to_${padOutput(output)}_level_${padLevel(level)}`] = {
						type: 'button',
						category: `Output ${padOutput(output)} – ${levelName}`,
						name: `Route In ${padInput(input)} → Out ${padOutput(output)} (${levelName})`,
						style: {
							text: `In ${padInput(input)}\\nOut ${padOutput(output)}\\n${levelName}`,
							size: 'auto',
							color: combineRgb(255, 255, 255),
							bgcolor: combineRgb(0, 0, 51),
						},
						steps: [
							{
								down: [
									{
										actionId: 'routeLevel',
										options: {
											input: input,
											output: output,
											level: level,
										},
									},
								],
								up: [],
							},
						],
						feedbacks: [
							{
								feedbackId: 'routeStatus',
								options: {
									input: input,
									output: output,
									level: level,
								},
								style: {
									bgcolor: combineRgb(0, 153, 255),
									color: combineRgb(255, 255, 255),
								},
							},
						],
					} satisfies CompanionButtonPresetDefinition
				}

				// Mute per level
				presets[`mute_output_${padOutput(output)}_level_${padLevel(level)}`] = {
					type: 'button',
					category: `Output ${padOutput(output)} – ${levelName}`,
					name: `Mute Output ${padOutput(output)} (${levelName})`,
					style: {
						text: `MUTE\\nOut ${padOutput(output)}\\n${levelName}`,
						size: 'auto',
						color: combineRgb(255, 255, 255),
						bgcolor: combineRgb(102, 0, 0),
					},
					steps: [
						{
							down: [
								{
									actionId: 'muteOutputLevel',
									options: {
										output: output,
										level: level,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'outputMuted',
							options: {
								output: output,
								level: level,
							},
							style: {
								bgcolor: combineRgb(255, 0, 0),
								color: combineRgb(255, 255, 255),
							},
						},
					],
				} satisfies CompanionButtonPresetDefinition
			}
		}
	}

	// Query status preset
	presets['query_status'] = {
		type: 'button',
		category: 'System',
		name: 'Query Status',
		style: {
			text: 'QUERY\\nSTATUS',
			size: 'auto',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 51, 102),
		},
		steps: [
			{
				down: [
					{
						actionId: 'queryStatus',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	} satisfies CompanionButtonPresetDefinition

	self.setPresetDefinitions(presets)
}
