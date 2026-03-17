import type { CompanionStaticUpgradeScript } from '@companion-module/base'
import type { SierraVideoConfig } from './config.js'

/**
 * Upgrade scripts for migrating configurations between module versions.
 *
 * Each entry should be a function that receives (context, props) and returns
 * updated action/feedback/config objects. Companion calls these in order
 * when loading configs saved with an older module version.
 */
export const UpgradeScripts: CompanionStaticUpgradeScript<SierraVideoConfig>[] = []
