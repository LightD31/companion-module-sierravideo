import type { ModuleInstance } from './main.js'

export interface DropdownChoice {
	id: number
	label: string
}

export function getInputChoices(self: ModuleInstance, includeMute = false): DropdownChoice[] {
	const choices: DropdownChoice[] = []
	if (includeMute) {
		choices.push({ id: 0, label: 'Mute (None)' })
	}
	const count = self.getInputCount()
	for (let i = 1; i <= count; i++) {
		choices.push({ id: i, label: `Input ${i}` })
	}
	return choices
}

export function getOutputChoices(self: ModuleInstance): DropdownChoice[] {
	const choices: DropdownChoice[] = []
	const count = self.getOutputCount()
	for (let i = 1; i <= count; i++) {
		choices.push({ id: i, label: `Output ${i}` })
	}
	return choices
}

export function getLevelChoices(self: ModuleInstance): DropdownChoice[] {
	const choices: DropdownChoice[] = []
	const count = self.getLevelCount()
	for (let i = 1; i <= count; i++) {
		const levelName = self.getLevelName(i)
		choices.push({ id: i, label: levelName })
	}
	return choices
}
