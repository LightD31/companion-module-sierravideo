## Sierra Video Protocol TCP

This module controls Sierra Video routing switchers using the Sierra Video Protocol over TCP.

### Configuration

- **Target IP Address**: The IP address of your Sierra Video router
- **Target Port**: TCP port (default: 23)
- **Auto-Detect Capabilities**: Automatically detect inputs, outputs, and levels from the device
- **Status Update Mode**: Choose between Automatic (real-time updates) or Polling mode

### Available Actions

- **Route (All Levels)**: Route an input to an output on all levels
- **Route (Single Level)**: Route an input to an output on a specific level
- **Route (Multiple Levels)**: Route different inputs per level using the V command
- **Mute Output**: Mute an output (route input 0)
- **Mute Output on Level**: Mute an output on a specific level
- **Query Routing Status**: Request current routing status
- **Query Device Info**: Query device model, version, and capabilities
- **Set Automatic Reports**: Enable or disable automatic output change reports
- **Send Custom Command**: Send a custom Sierra protocol command

### Feedbacks

- **Route Active**: Indicates when a specific input is routed to an output on a level
- **Output Muted**: Indicates when an output is muted
- **Input Routed Anywhere**: Indicates when an input is routed to any output on a level
