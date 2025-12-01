# Makefile for E-commerce Demo with Llama Stack and GenMCP
# 
# Usage:
#   make dev          - Run local development
#   make build        - Build all container images
#   make push         - Push images to registry
#   make deploy       - Deploy to OpenShift
#   make clean        - Clean up local resources

# Configuration
REGISTRY ?= quay.io/your-org
IMAGE_TAG ?= latest
NAMESPACE ?= rhug-demo

# Image names
FRONTEND_IMAGE = $(REGISTRY)/ecommerce-frontend:$(IMAGE_TAG)
LLAMA_STACK_IMAGE = $(REGISTRY)/llama-stack:$(IMAGE_TAG)
MCP_SERVER_IMAGE = $(REGISTRY)/mcp-server:$(IMAGE_TAG)

.PHONY: all dev build push deploy clean help

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# ============================================================================
# LOCAL DEVELOPMENT
# ============================================================================

dev: ## Run local development server
	pnpm dev

dev-all: ## Start all services locally (requires tmux or multiple terminals)
	@echo "Starting local development environment..."
	@echo "1. Start Ollama: ollama serve"
	@echo "2. Start Llama Stack: llama stack run llama-stack-config/run-ollama.yaml --port 8321"
	@echo "3. Start MCP Server: genmcp run -f mcpfile.yaml"
	@echo "4. Start Frontend: pnpm dev"
	@echo ""
	@echo "Or run each in a separate terminal."

install: ## Install dependencies
	pnpm install

lint: ## Run linter
	pnpm lint

# ============================================================================
# CONTAINER BUILDS
# ============================================================================

build: build-frontend build-llama-stack build-mcp-server ## Build all container images
	@echo "All images built successfully"

build-frontend: ## Build frontend container image
	@echo "Building frontend image: $(FRONTEND_IMAGE)"
	docker build -t $(FRONTEND_IMAGE) -f Dockerfile .

build-llama-stack: ## Build Llama Stack container image
	@echo "Building Llama Stack image: $(LLAMA_STACK_IMAGE)"
	docker build -t $(LLAMA_STACK_IMAGE) -f Dockerfile.llamastack .

build-mcp-server: ## Build MCP server container using GenMCP
	@echo "Building MCP server image: $(MCP_SERVER_IMAGE)"
	genmcp build -f mcpfile.yaml --tag $(MCP_SERVER_IMAGE)

# ============================================================================
# REGISTRY OPERATIONS
# ============================================================================

push: push-frontend push-llama-stack push-mcp-server ## Push all images to registry
	@echo "All images pushed successfully"

push-frontend: ## Push frontend image to registry
	docker push $(FRONTEND_IMAGE)

push-llama-stack: ## Push Llama Stack image to registry
	docker push $(LLAMA_STACK_IMAGE)

push-mcp-server: ## Push MCP server image to registry
	docker push $(MCP_SERVER_IMAGE)

login: ## Login to container registry
	docker login $(REGISTRY)

# ============================================================================
# OPENSHIFT DEPLOYMENT
# ============================================================================

deploy: deploy-secrets deploy-configmaps deploy-apps deploy-routes ## Deploy everything to OpenShift
	@echo "Deployment complete!"
	@echo "Run 'oc get routes -n $(NAMESPACE)' to get the frontend URL"

deploy-secrets: ## Create secrets in OpenShift
	@echo "Creating secrets..."
	oc create secret generic llama-stack-secrets \
		--from-literal=OPENAI_API_KEY=$${OPENAI_API_KEY} \
		-n $(NAMESPACE) --dry-run=client -o yaml | oc apply -f -

deploy-configmaps: ## Create ConfigMaps in OpenShift
	@echo "Creating ConfigMaps..."
	oc create configmap llama-stack-config \
		--from-file=run-openai.yaml=llama-stack-config/run-openai.yaml \
		-n $(NAMESPACE) --dry-run=client -o yaml | oc apply -f -
	oc create configmap mcp-config \
		--from-file=mcpfile.yaml=mcpfile.yaml \
		--from-file=openapi.json=public/openapi.json \
		-n $(NAMESPACE) --dry-run=client -o yaml | oc apply -f -

deploy-apps: ## Deploy application workloads
	@echo "Deploying applications..."
	oc apply -f k8s/deployment-frontend.yaml -n $(NAMESPACE)
	oc apply -f k8s/deployment-llama-stack.yaml -n $(NAMESPACE)
	oc apply -f k8s/deployment-mcp-server.yaml -n $(NAMESPACE)

deploy-routes: ## Create routes for external access
	@echo "Creating routes..."
	oc apply -f k8s/routes.yaml -n $(NAMESPACE)

# ============================================================================
# OPENSHIFT UTILITIES
# ============================================================================

create-namespace: ## Create OpenShift namespace
	oc new-project $(NAMESPACE) || oc project $(NAMESPACE)

delete-namespace: ## Delete OpenShift namespace (DANGER!)
	@echo "WARNING: This will delete all resources in $(NAMESPACE)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] && oc delete project $(NAMESPACE)

logs-frontend: ## View frontend logs
	oc logs -f deployment/frontend -n $(NAMESPACE)

logs-llama-stack: ## View Llama Stack logs
	oc logs -f deployment/llama-stack -n $(NAMESPACE)

logs-mcp-server: ## View MCP server logs
	oc logs -f deployment/mcp-server -n $(NAMESPACE)

status: ## Check deployment status
	@echo "=== Deployments ==="
	oc get deployments -n $(NAMESPACE)
	@echo "\n=== Pods ==="
	oc get pods -n $(NAMESPACE)
	@echo "\n=== Services ==="
	oc get services -n $(NAMESPACE)
	@echo "\n=== Routes ==="
	oc get routes -n $(NAMESPACE)

# ============================================================================
# GENMCP OPERATIONS
# ============================================================================

mcp-convert: ## Convert OpenAPI spec to mcpfile.yaml
	genmcp convert ./public/openapi.json -o mcpfile.yaml.new
	@echo "New mcpfile created: mcpfile.yaml.new"
	@echo "Review and merge changes manually"

mcp-run: ## Run MCP server locally
	genmcp run -f mcpfile.yaml

mcp-stop: ## Stop MCP server
	genmcp stop -f mcpfile.yaml

# ============================================================================
# EVALUATION
# ============================================================================

eval: ## Run evaluation scenarios
	@echo "Running evaluation..."
	cd eval && npx ts-node run-eval.ts

eval-install: ## Install evaluation dependencies
	npm install -g ts-node typescript @types/node

# ============================================================================
# CLEANUP
# ============================================================================

clean: ## Clean local build artifacts
	rm -rf .next
	rm -rf node_modules
	rm -rf eval/results.json

clean-images: ## Remove local container images
	docker rmi $(FRONTEND_IMAGE) || true
	docker rmi $(LLAMA_STACK_IMAGE) || true
	docker rmi $(MCP_SERVER_IMAGE) || true

