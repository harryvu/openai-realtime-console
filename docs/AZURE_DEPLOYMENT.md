# Azure Deployment Guide

This guide provides step-by-step instructions for deploying the US Citizenship Test Assistant to Azure using GitHub Actions.

## Prerequisites

- Azure subscription with appropriate permissions
- GitHub repository with the application code
- Azure CLI installed locally (for initial setup)

## Required Azure Resources

The deployment creates the following Azure resources:

- **Resource Group**: Container for all related resources
- **Azure Container Registry**: Stores Docker images
- **PostgreSQL Flexible Server**: Database with pgvector extension
- **Azure App Service**: Hosts the containerized application
- **Application Insights**: Application monitoring and analytics
- **Key Vault**: Secure storage for secrets
- **Log Analytics Workspace**: Centralized logging

## Setup Instructions

### 1. Create Azure Service Principal

Create a service principal for GitHub Actions authentication:

```bash
# Login to Azure
az login

# Set your subscription
az account set --subscription "your-subscription-id"

# Create service principal
az ad sp create-for-rbac --name "citizenship-test-github-actions" \
  --role contributor \
  --scopes /subscriptions/your-subscription-id \
  --sdk-auth
```

Save the JSON output - you'll need it for GitHub secrets.

### 2. Create Resource Group

```bash
# Create resource group
az group create --name "citizenship-test-rg" --location "East US"
```

### 3. Configure GitHub Secrets

Add the following secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

#### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AZURE_CREDENTIALS` | Service principal JSON from step 1 | `{"clientId": "...", "clientSecret": "...", ...}` |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID | `12345678-1234-1234-1234-123456789012` |
| `AZURE_RESOURCE_GROUP` | Resource group name | `citizenship-test-rg` |
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `SESSION_SECRET` | Secret for session management | `your-super-secret-session-key-change-this-in-production` |
| `POSTGRES_ADMIN_USERNAME` | PostgreSQL admin username | `citizenshipadmin` |
| `POSTGRES_ADMIN_PASSWORD` | PostgreSQL admin password | Strong password with mixed characters |

#### Optional Secrets (OAuth providers)

| Secret Name | Description |
|-------------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FACEBOOK_APP_ID` | Facebook OAuth app ID |
| `FACEBOOK_APP_SECRET` | Facebook OAuth app secret |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth client secret |

### 4. Update Workflow Variables

Edit `.github/workflows/deploy-azure.yml` and update these environment variables:

```yaml
env:
  AZURE_WEBAPP_NAME: 'citizenship-test-app'  # Your app name
  AZURE_CONTAINER_REGISTRY: 'citizenshiptestregistry'  # Your registry name
  DOCKER_IMAGE_NAME: 'citizenship-test-assistant'
  NODE_VERSION: '18'
```

### 5. Deploy the Application

The deployment will trigger automatically when you:

1. Push to the `main` branch, or
2. Manually trigger the workflow from GitHub Actions tab

#### Manual Deployment

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. Select "Deploy to Azure App Service"
4. Click "Run workflow"
5. Select environment (production/staging)
6. Click "Run workflow"

## Post-Deployment Configuration

### 1. Configure PostgreSQL Firewall

If needed, add additional firewall rules for your development environment:

```bash
# Add your IP to PostgreSQL firewall
az postgres flexible-server firewall-rule create \
  --resource-group citizenship-test-rg \
  --name your-postgres-server-name \
  --rule-name "AllowMyIP" \
  --start-ip-address "your.public.ip.address" \
  --end-ip-address "your.public.ip.address"
```

### 2. Initialize Database

The deployment automatically runs database migrations, but you can manually trigger them:

```bash
# Run database migrations via App Service
az webapp config appsettings set \
  --resource-group citizenship-test-rg \
  --name your-app-name \
  --settings MIGRATION_COMMAND="npm run db:migrate"
```

### 3. Verify Deployment

1. **Health Check**: Visit `https://your-app-name.azurewebsites.net/health`
2. **Application**: Visit `https://your-app-name.azurewebsites.net`
3. **Application Insights**: Check monitoring data in Azure portal

## Monitoring and Logging

### Application Insights

Monitor your application through Azure portal:

1. Navigate to your Application Insights resource
2. Key metrics to watch:
   - Request rate and response times
   - Failed requests
   - Custom events (citizenship-specific telemetry)
   - Database connection health

### Custom Telemetry Events

The application tracks these custom events:

- `Citizenship_PracticeQuestionRequested`: When users request practice questions
- `Citizenship_AnswerChecked`: When users submit answers
- `Citizenship_MessageEnhanced`: When RAG enhancement is used
- `HealthCheck`: Application health status

### Log Analytics

View detailed logs in Log Analytics workspace:

```kusto
// Recent application logs
traces
| where timestamp > ago(1h)
| where severityLevel >= 2
| order by timestamp desc

// Custom citizenship events
customEvents
| where name startswith "Citizenship_"
| where timestamp > ago(24h)
| summarize count() by name, bin(timestamp, 1h)
```

## Troubleshooting

### Common Issues

1. **Container Registry Access**
   - Ensure service principal has AcrPush and AcrPull permissions on ACR
   - Verify Azure login succeeded in GitHub Actions workflow

2. **Database Connection Failures**
   - Verify DATABASE_URL is correctly formatted
   - Check PostgreSQL firewall rules
   - Ensure pgvector extension is enabled

3. **Application Insights Not Working**
   - Verify APPLICATIONINSIGHTS_CONNECTION_STRING is set
   - Check if Application Insights resource is in same region

4. **Build Failures**
   - Check if all required secrets are set
   - Verify Node.js version compatibility
   - Review build logs in GitHub Actions

### Debug Commands

```bash
# Check app service logs
az webapp log tail --name your-app-name --resource-group citizenship-test-rg

# Check container logs
az webapp log show --name your-app-name --resource-group citizenship-test-rg

# Restart app service
az webapp restart --name your-app-name --resource-group citizenship-test-rg

# Check application settings
az webapp config appsettings list --name your-app-name --resource-group citizenship-test-rg
```

## Security Considerations

1. **Secrets Management**: All sensitive data is stored in Azure Key Vault
2. **HTTPS Only**: App Service is configured for HTTPS-only access
3. **Firewall Rules**: PostgreSQL has restrictive firewall configuration
4. **Managed Identity**: App Service uses system-assigned managed identity
5. **Container Security**: Multi-stage Docker build with non-root user

## Cost Optimization

### Production Environment

- **App Service Plan**: P1v3 (Premium) for high availability
- **PostgreSQL**: Standard_B2s with 128GB storage
- **Container Registry**: Basic tier

### Staging Environment

- **App Service Plan**: B1 (Basic) for cost savings
- **PostgreSQL**: Standard_B1ms with 32GB storage
- **Container Registry**: Basic tier (shared with production)

### Estimated Monthly Costs

- **Production**: ~$150-200/month
- **Staging**: ~$50-75/month

## Scaling Considerations

### Horizontal Scaling

```bash
# Scale out app service instances
az appservice plan update --name your-app-service-plan \
  --resource-group citizenship-test-rg \
  --number-of-workers 3
```

### Database Scaling

```bash
# Scale up PostgreSQL server
az postgres flexible-server update --name your-postgres-server \
  --resource-group citizenship-test-rg \
  --sku-name Standard_D2s_v3
```

## Backup and Recovery

### Database Backups

- **Automatic**: PostgreSQL Flexible Server provides automatic backups
- **Retention**: 7 days for production, 3 days for staging
- **Point-in-time recovery**: Available within retention period

### Application Backups

- **Container Images**: Stored in Azure Container Registry with retention policies
- **Configuration**: All infrastructure defined in Bicep templates for reproducibility

## Support

For deployment issues:

1. Check GitHub Actions logs
2. Review Azure portal diagnostics
3. Monitor Application Insights for runtime issues
4. Check this repository's issues tab for known problems