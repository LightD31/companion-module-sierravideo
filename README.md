# Companion Module: Sierra Video Protocol (TCP)

This is a [Bitfocus Companion](https://bitfocus.io/companion) module for controlling Sierra Video routing switchers over TCP using the Sierra Video Protocol.

## Features

- **Route Control**: Route any input to any output on all levels or specific levels
- **Mute Outputs**: Quickly mute outputs by routing input 0
- **Real-time Feedback**: Visual feedback showing current routing status
- **Auto-Reconnect**: Automatically reconnects if connection is lost
- **Configurable I/O**: Set the number of inputs, outputs, and levels for your specific router
- **Presets**: Pre-configured buttons for common routing operations
- **Variables**: Access current routing state in button text and triggers

## Installation

### From Companion

1. Open Companion and go to the Connections tab
2. Search for "Sierra Video" in the module list
3. Add the module and configure the connection settings

### Manual Installation (Development)

1. Clone or download this repository
2. Run `yarn install` to install dependencies
3. Follow the [Companion developer documentation](https://github.com/bitfocus/companion-module-base/wiki) to add a local module

## Configuration

| Setting                      | Description                                                                       | Default   |
| ---------------------------- | --------------------------------------------------------------------------------- | --------- |
| **Target IP Address**        | The IP address of the Sierra Video switcher                                       | -         |
| **Target Port**              | The TCP port of the switcher                                                      | 23        |
| **Auto-Detect Capabilities** | Automatically detect inputs, outputs, levels, and level names from the device     | true      |
| **Number of Inputs**         | Total inputs (manual override, only shown if auto-detect is off)                  | 32        |
| **Number of Outputs**        | Total outputs (manual override, only shown if auto-detect is off)                 | 32        |
| **Number of Levels**         | Number of routing levels (manual override, only shown if auto-detect is off)      | 8         |
| **Status Update Mode**       | How status updates are received (Automatic or Polling)                            | Automatic |
| **Polling Interval**         | How often to query status (ms). In Automatic mode, used as fallback sync interval | 5000      |
| **Auto-Reconnect**           | Automatically reconnect on disconnect                                             | true      |

### Status Update Modes

The module supports two modes for receiving routing status updates:

#### Automatic Mode (Recommended)

When set to **Automatic**, the module uses the `U` command (if supported by the device) to enable automatic output change reports. This means:

- The router sends updates **immediately** when routes change
- Lower network traffic (no constant polling)
- Faster feedback updates
- A fallback poll runs every 30 seconds to catch any missed updates

#### Polling Mode

When set to **Polling**, the module queries the router at regular intervals:

- Uses the configured polling interval (default 5 seconds)
- Compatible with all routers (even those without U command support)
- Status updates may be delayed by up to the polling interval

### Auto-Detection

When **Auto-Detect Capabilities** is enabled (default), the module will automatically:

- Send the `I` command to query supported commands
- Send the `Q` command to get model name and firmware version
- Send the `L` command to query device capabilities (inputs, outputs, levels)
- Retrieve level names (e.g., "Video", "Audio") if provided by the device
- Update all dropdowns and variables to reflect the actual device configuration

If auto-detection fails or you need to override, disable the option to manually configure the I/O counts.

## Actions

| Action                    | Description                                       |
| ------------------------- | ------------------------------------------------- |
| **Route (All Levels)**    | Route an input to an output on all levels (AFV)   |
| **Route (Single Level)**  | Route an input to an output on a specific level   |
| **Mute Output**           | Mute an output by routing input 0 to it           |
| **Mute Output on Level**  | Mute an output on a specific level                |
| **Query Routing Status**  | Manually request current routing status           |
| **Query Device Info**     | Query device model, version, and capabilities     |
| **Set Automatic Reports** | Enable or disable automatic output change reports |
| **Send Custom Command**   | Send a custom Sierra protocol command             |

## Feedbacks

| Feedback                  | Description                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| **Route Active**          | Changes button style when a specific input→output route is active |
| **Output Muted**          | Changes button style when an output is muted                      |
| **Input Routed Anywhere** | Changes button style when an input is used on any output          |

## Variables

| Variable                                              | Description                                       |
| ----------------------------------------------------- | ------------------------------------------------- |
| `$(sierra-video-protocol-tcp:output_X_level_Y_input)` | The input currently routed to output X on level Y |
| `$(sierra-video-protocol-tcp:connection_status)`      | Current connection status                         |
| `$(sierra-video-protocol-tcp:device_inputs)`          | Detected number of device inputs                  |
| `$(sierra-video-protocol-tcp:device_outputs)`         | Detected number of device outputs                 |
| `$(sierra-video-protocol-tcp:device_levels)`          | Detected number of device levels                  |
| `$(sierra-video-protocol-tcp:device_model)`           | Device model name (from Q command)                |
| `$(sierra-video-protocol-tcp:device_firmware)`        | Device firmware version (from Q command)          |
| `$(sierra-video-protocol-tcp:supported_commands)`     | Supported commands (from I command)               |
| `$(sierra-video-protocol-tcp:auto_reports)`           | Automatic reports status (enabled/disabled)       |
| `$(sierra-video-protocol-tcp:level_X_name)`           | Name of level X (e.g., "Video", "Audio")          |

### Example Variable Usage

- `$(sierra-video-protocol-tcp:output_1_level_1_input)` - Shows input routed to output 1, level 1
- `$(sierra-video-protocol-tcp:output_5_level_2_input)` - Shows input routed to output 5, level 2
- `$(sierra-video-protocol-tcp:level_1_name)` - Shows the name of level 1 (e.g., "Video")

## Protocol Reference

This module uses the Sierra Video Protocol, which is a text-based protocol. Commands are sent with `**` (leader) and `!!` (trailer) delimiters.

### Commands Sent to Router

| Command                 | Description                               | Example       |
| ----------------------- | ----------------------------------------- | ------------- |
| `**Y<out>,<in>!!`       | Route input to output on all levels       | `**Y1,5!!`    |
| `**X<out>,<in>,<lvl>!!` | Route input to output on a specific level | `**X12,9,2!!` |
| `**S!!`                 | Query full matrix status                  | `**S!!`       |
| `**L!!`                 | Query device capabilities and level names | `**L!!`       |
| `**I!!`                 | Query command capabilities                | `**I!!`       |
| `**Q!!`                 | Query model name and version              | `**Q!!`       |
| `**U<mode>!!`           | Enable automatic output change reports    | `**U4!!`      |

### Response Formats

| Response                                  | Description                                  | Example                          |
| ----------------------------------------- | -------------------------------------------- | -------------------------------- |
| `Y<out>,<in>`                             | Routing status (all levels same)             | `Y1,5`                           |
| `X<out>,<in>,<lvl>`                       | Routing status (per level)                   | `X12,9,2`                        |
| `V<out>,<in1>,<in2>,...`                  | Routing status (output with input per level) | `V3,1,2,2`                       |
| `L<out>,<lvl>,<in>,<name1>~<name2>~...~~` | Device capabilities                          | `L64,3,32,VIDEO~AudioL~AudioR~~` |

### Protocol Notes

- The protocol uses 7-bit ASCII characters
- Commands are case-insensitive when sending
- Responses end with `OK !!` on success or `ERROR !!` on failure
- Level names are terminated with `~` (tilde) characters

## Troubleshooting

### Connection Issues

1. Verify the IP address and port are correct
2. Ensure the router is powered on and network connected
3. Check that no firewall is blocking the connection
4. Try pinging the router from your Companion computer

### Feedback Not Updating

1. Check the polling interval setting
2. Manually trigger a status query using the "Query Status" action
3. Check Companion's log for any error messages

### Wrong Number of Inputs/Outputs

Adjust the Number of Inputs, Outputs, and Levels in the module configuration to match your specific router model.

## Development

```bash
# Install dependencies
yarn install

# Format code
yarn format

# Lint code
yarn lint

# Build for distribution
yarn package
```

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/bitfocus/companion-module-sierra-video-protocol-tcp/issues) page.
