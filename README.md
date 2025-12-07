# AI Agent E-commerce Demo

An interactive e-commerce demo showcasing AI agents with **Model Context Protocol (MCP)** tool integration. The agent can browse products, manage shopping carts, and perform admin operations through natural language.


## Features

- **Product Catalog** — Browse and search products
- **Shopping Cart** — Add items, view cart, clear cart
- **Admin Operations** — Update product pricing, reset demo data
- **Real-time Streaming** — Watch the agent think and execute tools live
- **Safety Banners** — Visual warnings for sensitive operations
- **Multiple Agent Backends** — OpenAI direct or Llama Stack

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                      (Next.js UI)                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Provider                            │
│              (OpenAI or Llama Stack)                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                              │
│                       (genmcp)                               │
│                                                              │
│  Tools:                                                      │
│  • get_api-products      - Query product catalog             │
│  • get_api-cart          - Retrieve cart state               │
│  • post_api-cart-items   - Add item to cart                  │
│  • delete_api-cart       - Clear cart                        │
│  • post_api-admin-pricing - Update product pricing           │
│  • delete_api-system-reset - Reset all data                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    E-commerce API                            │
│                  (Next.js API Routes)                        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Option 1: Docker Compose (Recommended)

**With OpenAI:**

```bash
# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env

# Start the stack
docker-compose -f docker-compose.openai.yml up -d
```

**With Ollama (local LLM):**

```bash
# Ensure Ollama is running with llama3.1 model
ollama pull llama3.1

# Start the stack
docker-compose -f docker-compose.ollama.yml up -d
```

### Option 2: Local Development

```bash
# Install dependencies
pnpm install

# Start the MCP server (in a separate terminal)
genmcp serve mcpfile.yaml --port 8080

# Start the Next.js app
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Agent Providers

The demo supports two agent backends, configured via the `AGENT_PROVIDER` environment variable:

### OpenAI Direct (`AGENT_PROVIDER=openai`)

- Connects directly to OpenAI API
- Agent loop runs in Next.js
- Calls MCP tools directly via `genmcp`

```env
AGENT_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
MCP_SERVER_URL=http://localhost:8080
```

### Llama Stack (`AGENT_PROVIDER=llamastack`)

- Uses Llama Stack as the agent runtime
- Agent loop runs in Llama Stack
- Supports Ollama, OpenAI, or other LLM providers

```env
AGENT_PROVIDER=llamastack
LLAMA_STACK_URL=http://localhost:8321
INFERENCE_MODEL=ollama/llama3.1:latest
```

## MCP Tools

Tools are defined in `mcpfile.yaml` and served by [genmcp](https://github.com/genmcp/gen-mcp):

| Tool | Description |
|------|-------------|
| `get_api-products` | Query the product catalog |
| `get_api-cart` | Retrieve current cart state |
| `post_api-cart-items` | Add a product to the cart |
| `delete_api-cart` | Clear all items from cart |
| `post_api-admin-pricing` | Update a product's price |
| `post_api-system-demo_reset` | Reset demo to defaults (**Not available in Tools, you need to manually POST to /api/system/demo_reset**)
| `delete_api-system-reset` | Delete all system data |

## Example Interactions

Try these prompts in the agent terminal:

```
"Show me all products"
"Add 2 laptops to my cart"
"What's in my cart?"
"Update the price of the laptop to $899"
"Clear my cart"
```

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/              # Backend API routes
│   │   │   ├── cart/         # Cart operations
│   │   │   ├── products/     # Product catalog
│   │   │   ├── admin/        # Admin operations
│   │   │   ├── chat/         # Agent chat endpoint
│   │   │   └── system/       # System operations
│   │   └── page.tsx          # Main UI
│   ├── components/
│   │   ├── AgentTerminal/    # Chat interface
│   │   ├── ProductGrid/      # Product display
│   │   ├── Cart/             # Shopping cart
│   │   └── SafetyBanner/     # Safety warnings
│   └── lib/
│       └── agent-providers/  # Agent backend adapters
│           ├── openai-provider.ts
│           └── llamastack-provider.ts
├── mcpfile.yaml              # MCP tool definitions
├── llama-stack-config/       # Llama Stack configs
└── docker-compose.*.yml      # Docker configurations
```

## Deployment

### OpenShift / Kubernetes

```bash
# Deploy to OpenShift
./deploy-openshift.sh
```


## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_PROVIDER` | `openai` | Agent backend (`openai` or `llamastack`) |
| `OPENAI_API_KEY` | — | OpenAI API key (for OpenAI provider) |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model to use |
| `LLAMA_STACK_URL` | `http://localhost:8321` | Llama Stack server URL |
| `INFERENCE_MODEL` | `ollama/llama3.1:latest` | Model ID for Llama Stack |
| `MCP_SERVER_URL` | `http://localhost:8080` | genmcp server URL |

## Troubleshooting

Join genmcp Discord for help: https://discord.com/invite/AwP6GAUEQR

## License

MIT

## Disclaimer

The majority of the code contains in this repository are generated by LLM. Please use it as a reference only. Also please be aware that the code is not production ready and may contain bugs and security vulnerabilities.