# ContentedCal MCP Server

MCP server that connects Claude (and other AI tools) to your ContentedCal workspace via the public API.

## Setup

1. **Create an API key** in ContentedCal → Settings → API
2. **Install dependencies**: `cd mcp-server && npm install && npm run build`
3. **Add to Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "contentedcal": {
      "command": "node",
      "args": ["/path/to/contented-cal/mcp-server/dist/index.js"],
      "env": {
        "CONTENTEDCAL_API_KEY": "cc_sk_your_key_here"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `list_items` | List and filter content items |
| `get_item` | Get a single item by ID |
| `create_item` | Create a new content item |
| `update_item` | Update an existing item |
| `delete_item` | Delete an item (requires full scope) |
| `list_types` | List content types |
| `list_statuses` | List board column statuses |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTENTEDCAL_API_KEY` | Yes | API key from Settings → API |
| `CONTENTEDCAL_API_URL` | No | Override the API base URL |
