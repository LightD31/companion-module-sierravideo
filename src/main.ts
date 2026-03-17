import { InstanceBase, runEntrypoint, InstanceStatus, Regex } from '@companion-module/base'
import type { SomeCompanionConfigField, CompanionVariableValues } from '@companion-module/base'
import net from 'net'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpdatePresets } from './presets.js'
import type { SierraVideoConfig, DeviceCapabilities, RoutingStatus } from './config.js'
import {
	DEFAULT_PORT,
	DEFAULT_POLL_INTERVAL,
	DEFAULT_OUTPUTS,
	DEFAULT_INPUTS,
	DEFAULT_LEVELS,
	RECONNECT_DELAY,
	CONNECTION_TIMEOUT,
	FALLBACK_POLL_INTERVAL,
	STATUS_MODE_POLLING,
	STATUS_MODE_AUTO,
	DISCOVERY_CMD_DELAY,
	RECEIVE_BUFFER_LIMIT,
	KEEP_ALIVE_INTERVAL,
} from './config.js'
import {
	classifyMessage,
	parseError,
	parseCommandCapabilities,
	parseModelInfo as parseModelInfoResponse,
	parseDeviceCapabilities as parseDeviceCapabilitiesResponse,
	parseRoutingCommands,
} from './protocol.js'

export class ModuleInstance extends InstanceBase<SierraVideoConfig> {
	public config!: SierraVideoConfig
	public routingStatus: RoutingStatus = {}
	public deviceCapabilities: DeviceCapabilities = {
		detected: false,
		inputs: DEFAULT_INPUTS,
		outputs: DEFAULT_OUTPUTS,
		levels: DEFAULT_LEVELS,
		levelNames: {},
		modelName: '',
		firmwareVersion: '',
		supportedCommands: [],
		supportsX: false,
		supportsY: false,
		supportsV: false,
		supportsU: false,
		maxUArg: 0,
	}

	private socket: net.Socket | null = null
	private pollInterval: ReturnType<typeof setInterval> | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private connectionTimeout: ReturnType<typeof setTimeout> | null = null
	private receiveBuffer = ''
	private isConnecting = false
	private shouldReconnect = true
	private automaticReportsEnabled = false

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: SierraVideoConfig): Promise<void> {
		this.config = config
		this.shouldReconnect = true

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()

		this.updateStatus(InstanceStatus.Connecting)
		this.initTcp()
	}

	async destroy(): Promise<void> {
		this.shouldReconnect = false
		this.cleanupConnection()
		this.log('debug', 'Module destroyed')
	}

	async configUpdated(config: SierraVideoConfig): Promise<void> {
		const reconnectRequired = this.config.host !== config.host || this.config.port !== config.port

		this.config = config

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()

		if (reconnectRequired) {
			this.initTcp()
		} else {
			this.setupPolling()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This module controls Sierra Video routing switchers using the Sierra Video Protocol over TCP.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP Address',
				width: 6,
				regex: Regex.IP,
				required: true,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 6,
				regex: Regex.PORT,
				default: String(DEFAULT_PORT),
			},
			{
				type: 'static-text',
				id: 'separator1',
				width: 12,
				label: '',
				value: '<hr />',
			},
			{
				type: 'static-text',
				id: 'capabilitiesInfo',
				width: 12,
				label: 'Device Capabilities',
				value:
					'The module will automatically detect device capabilities on connection. Use manual overrides below only if auto-detection fails.',
			},
			{
				type: 'checkbox',
				id: 'autoDetect',
				label: 'Auto-Detect Capabilities',
				width: 12,
				default: true,
				tooltip: 'Automatically detect inputs, outputs, and levels from the device on connection',
			},
			{
				type: 'number',
				id: 'inputCount',
				label: 'Number of Inputs (Manual Override)',
				width: 4,
				default: DEFAULT_INPUTS,
				min: 1,
				max: 1024,
				isVisible: (options) => !options.autoDetect,
			},
			{
				type: 'number',
				id: 'outputCount',
				label: 'Number of Outputs (Manual Override)',
				width: 4,
				default: DEFAULT_OUTPUTS,
				min: 1,
				max: 1024,
				isVisible: (options) => !options.autoDetect,
			},
			{
				type: 'number',
				id: 'levelCount',
				label: 'Number of Levels (Manual Override)',
				width: 4,
				default: DEFAULT_LEVELS,
				min: 1,
				max: 8,
				isVisible: (options) => !options.autoDetect,
			},
			{
				type: 'static-text',
				id: 'separator2',
				width: 12,
				label: '',
				value: '<hr />',
			},
			{
				type: 'dropdown',
				id: 'statusMode',
				label: 'Status Update Mode',
				width: 6,
				default: STATUS_MODE_AUTO,
				choices: [
					{ id: STATUS_MODE_AUTO, label: 'Automatic (recommended)' },
					{ id: STATUS_MODE_POLLING, label: 'Polling' },
				],
				tooltip:
					'Automatic mode uses the U command to receive real-time updates when routes change. Polling mode queries status at regular intervals. Automatic is recommended for faster updates and lower network traffic.',
			},
			{
				type: 'number',
				id: 'pollInterval',
				label: 'Polling Interval (ms)',
				width: 6,
				default: DEFAULT_POLL_INTERVAL,
				min: 500,
				max: 60000,
				tooltip:
					'How often to query the router for current status. In Automatic mode, this is used as a fallback sync interval.',
			},
			{
				type: 'checkbox',
				id: 'reconnect',
				label: 'Auto-Reconnect',
				width: 6,
				default: true,
				tooltip: 'Automatically reconnect if connection is lost',
			},
		]
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	getInputCount(): number {
		if (this.config.autoDetect !== false && this.deviceCapabilities.detected) {
			return this.deviceCapabilities.inputs
		}
		return this.config.inputCount || DEFAULT_INPUTS
	}

	getOutputCount(): number {
		if (this.config.autoDetect !== false && this.deviceCapabilities.detected) {
			return this.deviceCapabilities.outputs
		}
		return this.config.outputCount || DEFAULT_OUTPUTS
	}

	getLevelCount(): number {
		if (this.config.autoDetect !== false && this.deviceCapabilities.detected) {
			return this.deviceCapabilities.levels
		}
		return this.config.levelCount || DEFAULT_LEVELS
	}

	getLevelName(level: number): string {
		return this.deviceCapabilities.levelNames[level] || `Level ${level}`
	}

	getLevelNames(): Record<number, string> {
		return this.deviceCapabilities.levelNames
	}

	private cleanupConnection(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = null
		}

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}

		if (this.connectionTimeout) {
			clearTimeout(this.connectionTimeout)
			this.connectionTimeout = null
		}

		if (this.socket) {
			this.socket.removeAllListeners()
			this.socket.destroy()
			this.socket = null
		}

		this.isConnecting = false
		this.receiveBuffer = ''
	}

	private scheduleReconnect(): void {
		if (!this.shouldReconnect || this.config.reconnect === false) {
			return
		}

		if (this.reconnectTimer) {
			return
		}

		this.log('debug', `Scheduling reconnect in ${RECONNECT_DELAY}ms`)
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.initTcp()
		}, RECONNECT_DELAY)
	}

	private setupPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
			this.pollInterval = null
		}

		let interval: number

		if (this.automaticReportsEnabled) {
			interval = FALLBACK_POLL_INTERVAL
			this.log('debug', `Automatic reports enabled - using fallback polling interval: ${interval}ms`)
		} else {
			interval = this.config.pollInterval || DEFAULT_POLL_INTERVAL
			this.log('debug', `Using polling interval: ${interval}ms`)
		}

		this.pollInterval = setInterval(() => {
			this.queryStatus()
		}, interval)
	}

	private initTcp(): void {
		this.cleanupConnection()

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'IP address not configured')
			return
		}

		const port = parseInt(String(this.config.port)) || DEFAULT_PORT
		this.isConnecting = true
		this.updateStatus(InstanceStatus.Connecting)

		this.socket = new net.Socket()
		this.socket.setKeepAlive(true, KEEP_ALIVE_INTERVAL)

		this.connectionTimeout = setTimeout(() => {
			if (this.isConnecting) {
				this.log('error', 'Connection timeout')
				this.socket?.destroy()
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection timeout')
				this.scheduleReconnect()
			}
		}, CONNECTION_TIMEOUT)

		this.socket.connect(port, this.config.host)

		this.socket.on('connect', () => {
			this.isConnecting = false
			if (this.connectionTimeout) {
				clearTimeout(this.connectionTimeout)
				this.connectionTimeout = null
			}

			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Connected to ${this.config.host}:${port}`)

			this.automaticReportsEnabled = false

			if (this.config.autoDetect !== false) {
				this.queryCommandCapabilities()
				setTimeout(() => this.queryModelInfo(), DISCOVERY_CMD_DELAY)
				setTimeout(() => this.queryDeviceCapabilities(), DISCOVERY_CMD_DELAY * 2)
				setTimeout(() => this.enableAutomaticReports(), DISCOVERY_CMD_DELAY * 3)
			}

			setTimeout(
				() => {
					this.queryStatus()
					this.setupPolling()
				},
				this.config.autoDetect !== false ? DISCOVERY_CMD_DELAY * 4 + DISCOVERY_CMD_DELAY / 2 : 0,
			)
		})

		this.socket.on('data', (data: Buffer) => {
			this.processData(data)
		})

		this.socket.on('error', (err: Error) => {
			this.isConnecting = false
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.log('error', `Connection error: ${err.message}`)
		})

		this.socket.on('close', (hadError: boolean) => {
			this.isConnecting = false
			if (this.connectionTimeout) {
				clearTimeout(this.connectionTimeout)
				this.connectionTimeout = null
			}

			if (this.pollInterval) {
				clearInterval(this.pollInterval)
				this.pollInterval = null
			}

			if (this.shouldReconnect) {
				this.updateStatus(InstanceStatus.Disconnected, 'Connection closed')
				this.log('info', 'Connection closed' + (hadError ? ' due to error' : ''))
				this.scheduleReconnect()
			}
		})
	}

	processData(data: Buffer): void {
		this.receiveBuffer += data.toString()

		while (this.receiveBuffer.includes('!!')) {
			const endIndex = this.receiveBuffer.indexOf('!!') + 2
			const message = this.receiveBuffer.substring(0, endIndex)
			this.receiveBuffer = this.receiveBuffer.substring(endIndex)

			this.parseResponse(message)
		}

		// Prevent buffer from growing too large - keep data after last delimiter
		if (this.receiveBuffer.length > RECEIVE_BUFFER_LIMIT) {
			this.log('warn', 'Receive buffer overflow, truncating to last message boundary')
			const lastDelimiter = this.receiveBuffer.lastIndexOf('!!')
			if (lastDelimiter >= 0) {
				this.receiveBuffer = this.receiveBuffer.substring(lastDelimiter + 2)
			} else {
				this.receiveBuffer = ''
			}
		}
	}

	parseResponse(message: string): void {
		this.log('debug', `Received: ${message}`)

		const messageType = classifyMessage(message)

		switch (messageType) {
			case 'error':
				this.log('warn', `Device error: ${parseError(message)}`)
				return
			case 'capabilities':
				this.handleCommandCapabilities(message)
				return
			case 'model':
				this.handleModelInfo(message)
				return
			case 'device':
				this.handleDeviceCapabilities(message)
				return
			case 'routing': {
				const result = parseRoutingCommands(message, this.routingStatus, this.getLevelCount())
				if (result.updatedOutputs) {
					this.setVariableValues(result.variableValues)
					this.checkFeedbacks('routeStatus', 'outputMuted', 'inputRouted')
				}
				return
			}
		}
	}

	private queryCommandCapabilities(): void {
		this.log('info', 'Querying supported commands...')
		this.sendCommand('I')
	}

	private handleCommandCapabilities(message: string): void {
		this.log('debug', `Parsing command capabilities: ${message}`)

		const result = parseCommandCapabilities(message)
		if (result) {
			this.deviceCapabilities.supportedCommands = result.commands
			this.deviceCapabilities.supportsX = result.supportsX
			this.deviceCapabilities.supportsY = result.supportsY
			this.deviceCapabilities.supportsV = result.supportsV
			this.deviceCapabilities.supportsU = result.supportsU

			this.log('info', `Supported commands: ${result.commands.join(', ')}`)

			if (result.supportsU) {
				this.log('info', 'Device supports automatic output change reports (U command)')
			}

			this.setVariableValues({
				supported_commands: result.commands.join(','),
			})
		}
	}

	private queryModelInfo(): void {
		this.log('info', 'Querying model info...')
		this.sendCommand('Q')
	}

	private handleModelInfo(message: string): void {
		this.log('debug', `Parsing model info: ${message}`)

		const result = parseModelInfoResponse(message)
		if (result) {
			this.deviceCapabilities.modelName = result.modelName
			this.deviceCapabilities.firmwareVersion = result.firmwareVersion

			this.log('info', `Device: ${result.modelName}, Firmware: ${result.firmwareVersion}`)

			this.setVariableValues({
				device_model: result.modelName,
				device_firmware: result.firmwareVersion,
			})
		}
	}

	private queryDeviceCapabilities(): void {
		this.log('info', 'Querying device capabilities...')
		this.sendCommand('L')
	}

	private handleDeviceCapabilities(message: string): void {
		this.log('debug', `Parsing device capabilities: ${message}`)

		const result = parseDeviceCapabilitiesResponse(message)
		if (!result) {
			this.log('debug', 'Could not parse device capabilities from L response')
			return
		}

		this.deviceCapabilities.detected = true
		this.deviceCapabilities.outputs = result.outputs
		this.deviceCapabilities.levels = result.levels
		this.deviceCapabilities.inputs = result.inputs
		this.deviceCapabilities.levelNames = result.levelNames

		this.log(
			'info',
			`Device capabilities detected: ${result.outputs} outputs, ${result.levels} levels, ${result.inputs} inputs`,
		)

		if (Object.keys(result.levelNames).length > 0) {
			const levelNamesLog = Object.entries(result.levelNames)
				.map(([num, name]) => `${num}:${name}`)
				.join(', ')
			this.log('info', `Level names: ${levelNamesLog}`)
		}

		const variableValues: CompanionVariableValues = {
			device_inputs: result.inputs,
			device_outputs: result.outputs,
			device_levels: result.levels,
		}

		for (const [level, name] of Object.entries(result.levelNames)) {
			variableValues[`level_${level}_name`] = name
		}

		this.setVariableValues(variableValues)

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
	}

	queryStatus(): void {
		this.sendCommand('S')
	}

	enableAutomaticReports(): void {
		if (this.config.statusMode !== STATUS_MODE_AUTO) {
			this.log('debug', 'Automatic reports disabled in config, using polling mode')
			this.automaticReportsEnabled = false
			return
		}

		if (!this.deviceCapabilities.supportsU) {
			this.log('info', 'Device does not support automatic reports (U command), using polling mode')
			this.automaticReportsEnabled = false
			return
		}

		let uMode = 4

		if (this.deviceCapabilities.maxUArg > 0 && this.deviceCapabilities.maxUArg < 4) {
			uMode = this.deviceCapabilities.maxUArg
		}

		this.log('info', `Enabling automatic output change reports (U${uMode})`)
		this.sendCommand(`U${uMode}`)
		this.automaticReportsEnabled = true

		this.setVariableValues({
			auto_reports: 'enabled',
		})

		this.setupPolling()
	}

	disableAutomaticReports(): void {
		if (this.deviceCapabilities.supportsU) {
			this.log('info', 'Disabling automatic output change reports (U0)')
			this.sendCommand('U0')
		}
		this.automaticReportsEnabled = false

		this.setVariableValues({
			auto_reports: 'disabled',
		})

		this.setupPolling()
	}

	sendCommand(cmd: string): boolean {
		if (this.socket && this.socket.writable) {
			const fullCommand = `**${cmd}!!`
			this.log('debug', `Sending: ${fullCommand}`)
			this.socket.write(fullCommand)
			return true
		} else {
			this.log('warn', 'Cannot send command - not connected')
			return false
		}
	}

	getRouting(output: number, level: number): number | null {
		return this.routingStatus[output]?.[level] ?? null
	}

	isRouteActive(output: number, input: number, level: number): boolean {
		return this.routingStatus[output]?.[level] === input
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
