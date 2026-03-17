import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const variables: CompanionVariableDefinition[] = []
	const outputCount = self.getOutputCount()
	const levelCount = self.getLevelCount()

	// Create variables for each output/level combination
	for (let output = 1; output <= outputCount; output++) {
		for (let level = 1; level <= levelCount; level++) {
			const levelName = self.getLevelName(level)
			variables.push({
				variableId: `output_${output}_level_${level}_input`,
				name: `Output ${output} ${levelName} - Current Input`,
			})
		}
	}

	// Add connection status variable
	variables.push({ variableId: 'connection_status', name: 'Connection Status' })

	// Add device capability variables
	variables.push({ variableId: 'device_inputs', name: 'Device - Total Inputs' })
	variables.push({ variableId: 'device_outputs', name: 'Device - Total Outputs' })
	variables.push({ variableId: 'device_levels', name: 'Device - Total Levels' })
	variables.push({ variableId: 'device_model', name: 'Device - Model Name' })
	variables.push({ variableId: 'device_firmware', name: 'Device - Firmware Version' })
	variables.push({ variableId: 'supported_commands', name: 'Device - Supported Commands' })
	variables.push({ variableId: 'auto_reports', name: 'Device - Automatic Reports Status' })

	// Add level name variables
	for (let level = 1; level <= levelCount; level++) {
		variables.push({ variableId: `level_${level}_name`, name: `Level ${level} Name` })
	}

	self.setVariableDefinitions(variables)

	// Set initial values
	const initialValues: CompanionVariableValues = {
		connection_status: 'Disconnected',
		device_inputs: self.getInputCount(),
		device_outputs: self.getOutputCount(),
		device_levels: self.getLevelCount(),
		device_model: '',
		device_firmware: '',
		supported_commands: '',
		auto_reports: 'disabled',
	}

	for (let output = 1; output <= outputCount; output++) {
		for (let level = 1; level <= levelCount; level++) {
			initialValues[`output_${output}_level_${level}_input`] = '-'
		}
	}

	// Set level names
	for (let level = 1; level <= levelCount; level++) {
		initialValues[`level_${level}_name`] = self.getLevelName(level)
	}

	self.setVariableValues(initialValues)
}
