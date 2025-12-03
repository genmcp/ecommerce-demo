#!/bin/bash

# OpenShift Deployment Script for E-commerce Demo
# This script deploys the complete application stack to OpenShift

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="${OPENSHIFT_PROJECT:-ecommerce-demo}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-quay.io/rh-ee-leoli/ecommerce-frontend:latest}"
MCP_SERVER_IMAGE="${MCP_SERVER_IMAGE:-quay.io/rh-ee-leoli/mcpfile-openai:latest}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check if oc is installed
    if ! command -v oc &> /dev/null; then
        print_error "OpenShift CLI (oc) is not installed. Please install it first."
        exit 1
    fi
    print_success "OpenShift CLI found"

    # Check if logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        print_error "Not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    print_success "Logged in as: $(oc whoami)"

    # Check if docker is installed (for building)
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    print_success "Docker found"

    # Check if .env file exists
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create it with OPENAI_API_KEY"
        exit 1
    fi
    print_success ".env file found"

    # Check if OPENAI_API_KEY is set in .env
    if ! grep -q "OPENAI_API_KEY=" .env; then
        print_error "OPENAI_API_KEY not found in .env file"
        exit 1
    fi
    print_success "OPENAI_API_KEY found in .env"
}

create_or_use_project() {
    print_header "Setting Up OpenShift Project"

    if oc project "$PROJECT_NAME" &> /dev/null; then
        print_info "Using existing project: $PROJECT_NAME"
    else
        print_info "Creating new project: $PROJECT_NAME"
        oc new-project "$PROJECT_NAME"
        print_success "Project created: $PROJECT_NAME"
    fi
}

build_and_push_images() {
    print_header "Building and Pushing Container Images"

    # Build frontend image
    print_info "Building frontend image: $FRONTEND_IMAGE"
    docker build -t "$FRONTEND_IMAGE" .
    print_success "Frontend image built"

    # Push frontend image
    print_info "Pushing frontend image to registry..."
    docker push "$FRONTEND_IMAGE"
    print_success "Frontend image pushed"

    # MCP server image should already be built
    print_info "MCP server image: $MCP_SERVER_IMAGE (using existing)"
}

create_secret() {
    print_header "Creating OpenShift Secret"

    # Load OPENAI_API_KEY from .env
    source .env

    if [ -z "$OPENAI_API_KEY" ]; then
        print_error "OPENAI_API_KEY is empty in .env file"
        exit 1
    fi

    # Delete existing secret if it exists
    if oc get secret openai-secret &> /dev/null; then
        print_info "Deleting existing secret..."
        oc delete secret openai-secret
    fi

    # Create new secret
    print_info "Creating OpenAI API key secret..."
    oc create secret generic openai-secret \
        --from-literal=api-key="$OPENAI_API_KEY"
    print_success "Secret created"
}

deploy_application() {
    print_header "Deploying Application"

    print_info "Applying Kubernetes manifests..."
    oc apply -f k8s/deployment-openai.yaml
    print_success "Manifests applied"

    # Patch route to allow HTTP access
    print_info "Configuring route for HTTP access..."
    sleep 2  # Give time for route to be created
    oc patch route frontend --type=json \
        -p '[{"op": "replace", "path": "/spec/tls/insecureEdgeTerminationPolicy", "value": "Allow"}]'
    print_success "Route configured"
}

wait_for_deployment() {
    print_header "Waiting for Deployments"

    print_info "Waiting for MCP server deployment..."
    oc rollout status deployment/mcp-server --timeout=5m
    print_success "MCP server ready"

    print_info "Waiting for frontend deployment..."
    oc rollout status deployment/frontend --timeout=5m
    print_success "Frontend ready"
}

display_info() {
    print_header "Deployment Summary"

    # Get route URL
    ROUTE_URL=$(oc get route frontend -o jsonpath='{.spec.host}')

    echo ""
    print_success "Application deployed successfully!"
    echo ""
    echo -e "${GREEN}🌐 Frontend URL (HTTPS):${NC} https://$ROUTE_URL"
    echo -e "${GREEN}🌐 Frontend URL (HTTP):${NC}  http://$ROUTE_URL"
    echo ""
    echo -e "${BLUE}Deployed Resources:${NC}"
    oc get all -l app=ecommerce-demo
    echo ""

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View pods:        oc get pods -l app=ecommerce-demo"
    echo "  View logs:        oc logs deployment/frontend -f"
    echo "  View route:       oc get route frontend"
    echo "  Scale frontend:   oc scale deployment/frontend --replicas=2"
    echo "  Delete all:       oc delete -f k8s/deployment-openai.yaml"
    echo ""

    echo -e "${BLUE}API Endpoints (HTTP):${NC}"
    echo "  Products:         curl http://$ROUTE_URL/api/products"
    echo "  Cart:             curl http://$ROUTE_URL/api/cart"
    echo "  Demo Reset:       curl -X POST http://$ROUTE_URL/api/system/demo_reset"
    echo ""
}

cleanup() {
    print_header "Cleanup"

    read -p "Do you want to delete all resources? (yes/no): " -r
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_info "Deleting all resources..."
        oc delete -f k8s/deployment-openai.yaml
        oc delete secret openai-secret
        print_success "Resources deleted"
    else
        print_info "Skipping cleanup"
    fi
}

# Main deployment flow
main() {
    print_header "E-commerce Demo - OpenShift Deployment"
    echo ""

    # Parse command line arguments
    SKIP_BUILD=false
    CLEANUP_ONLY=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --cleanup)
                CLEANUP_ONLY=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-build    Skip building and pushing images"
                echo "  --cleanup       Delete all deployed resources"
                echo "  --help          Show this help message"
                echo ""
                echo "Environment Variables:"
                echo "  OPENSHIFT_PROJECT    OpenShift project name (default: ecommerce-demo)"
                echo "  FRONTEND_IMAGE       Frontend container image (default: quay.io/rh-ee-leoli/ecommerce-frontend:latest)"
                echo "  MCP_SERVER_IMAGE     MCP server image (default: quay.io/rh-ee-leoli/mcpfile-openai:latest)"
                echo "  OPENAI_MODEL         OpenAI model to use (default: gpt-4o-mini)"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    if [ "$CLEANUP_ONLY" = true ]; then
        check_prerequisites
        create_or_use_project
        cleanup
        exit 0
    fi

    # Run deployment steps
    check_prerequisites
    create_or_use_project

    if [ "$SKIP_BUILD" = false ]; then
        build_and_push_images
    else
        print_info "Skipping build step (--skip-build flag set)"
    fi

    create_secret
    deploy_application
    wait_for_deployment
    display_info

    print_success "Deployment complete! 🎉"
}

# Run main function
main "$@"
