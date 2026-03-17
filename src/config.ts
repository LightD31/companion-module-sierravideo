export interface SierraVideoConfig {
	host: string
	port: number
	autoDetect: boolean
	inputCount: number
	outputCount: number
	levelCount: number
	statusMode: string
	pollInterval: number
	reconnect: boolean
}

export interface DeviceCapabilities {
	detected: boolean
	inputs: number
	outputs: number
	levels: number
	levelNames: Record<number, string>
	modelName: string
	firmwareVersion: string
	supportedCommands: string[]
	supportsX: boolean
	supportsY: boolean
	supportsV: boolean
	supportsU: boolean
	maxUArg: number
}

export interface RoutingStatus {
	[output: number]: {
		[level: number]: number
	}
}

export const DEFAULT_PORT = 23
export const DEFAULT_POLL_INTERVAL = 5000
export const DEFAULT_OUTPUTS = 32
export const DEFAULT_INPUTS = 32
export const DEFAULT_LEVELS = 8
export const RECONNECT_DELAY = 5000
export const CONNECTION_TIMEOUT = 10000
export const FALLBACK_POLL_INTERVAL = 30000
export const STATUS_MODE_POLLING = 'polling'
export const STATUS_MODE_AUTO = 'auto'

/** Delays (ms) between sequential discovery commands sent after connection */
export const DISCOVERY_CMD_DELAY = 200
/** Buffer size limit (bytes) before truncation to prevent memory issues */
export const RECEIVE_BUFFER_LIMIT = 10000
/** Keep-alive interval (ms) for the TCP socket */
export const KEEP_ALIVE_INTERVAL = 30000
