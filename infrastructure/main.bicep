// Main Bicep template for US Citizenship Test Assistant Azure infrastructure

@description('The name of the application')
param appName string

@description('The name of the container registry')
param containerRegistryName string

@description('The name of the Docker image')
param dockerImageName string

@description('OpenAI API key for the application')
@secure()
param openaiApiKey string

@description('Session secret for the application')
@secure()
param sessionSecret string

@description('PostgreSQL admin username')
@secure()
param postgresAdminUsername string

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('Environment (production, staging)')
@allowed(['production', 'staging'])
param environment string = 'production'

@description('Location for all resources')
param location string = resourceGroup().location

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var webAppName = '${appName}-${environment}-${uniqueSuffix}'
var containerRegistryNameUnique = '${containerRegistryName}${uniqueSuffix}'
var postgresServerName = '${appName}-postgres-${environment}-${uniqueSuffix}'
var keyVaultName = '${appName}-kv-${environment}-${uniqueSuffix}'
var appInsightsName = '${appName}-insights-${environment}-${uniqueSuffix}'
var logAnalyticsName = '${appName}-logs-${environment}-${uniqueSuffix}'
var appServicePlanName = '${appName}-plan-${environment}-${uniqueSuffix}'

// Key Vault
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyVault'
  params: {
    keyVaultName: keyVaultName
    location: location
    tenantId: tenant().tenantId
  }
}

// Log Analytics Workspace
module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    workspaceName: logAnalyticsName
    location: location
  }
}

// Application Insights
module appInsights 'modules/appinsights.bicep' = {
  name: 'appInsights'
  params: {
    appInsightsName: appInsightsName
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

// Container Registry
module containerRegistry 'modules/containerregistry.bicep' = {
  name: 'containerRegistry'
  params: {
    registryName: containerRegistryNameUnique
    location: location
  }
}

// PostgreSQL Flexible Server
module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    serverName: postgresServerName
    location: location
    administratorLogin: postgresAdminUsername
    administratorPassword: postgresAdminPassword
    environment: environment
  }
}

// App Service Plan
module appServicePlan 'modules/appserviceplan.bicep' = {
  name: 'appServicePlan'
  params: {
    planName: appServicePlanName
    location: location
    environment: environment
  }
}

// Web App
module webApp 'modules/webapp.bicep' = {
  name: 'webApp'
  params: {
    webAppName: webAppName
    location: location
    appServicePlanId: appServicePlan.outputs.planId
    containerRegistryUrl: containerRegistry.outputs.registryUrl
    dockerImageName: dockerImageName
    postgresConnectionString: postgres.outputs.connectionString
    appInsightsConnectionString: appInsights.outputs.connectionString
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    keyVaultName: keyVault.outputs.keyVaultName
    openaiApiKey: openaiApiKey
    sessionSecret: sessionSecret
    environment: environment
  }
}

// Store secrets in Key Vault
resource openaiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.outputs.keyVaultName}/openai-api-key'
  properties: {
    value: openaiApiKey
  }
  dependsOn: [
    keyVault
  ]
}

resource sessionSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.outputs.keyVaultName}/session-secret'
  properties: {
    value: sessionSecret
  }
  dependsOn: [
    keyVault
  ]
}

resource postgresConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.outputs.keyVaultName}/postgres-connection-string'
  properties: {
    value: postgres.outputs.connectionString
  }
  dependsOn: [
    keyVault
    postgres
  ]
}

// Outputs
output webappName string = webApp.outputs.webAppName
output webappUrl string = webApp.outputs.webAppUrl
output resourceGroupName string = resourceGroup().name
output containerRegistryUrl string = containerRegistry.outputs.registryUrl
output postgresServerName string = postgres.outputs.serverName
output appInsightsInstrumentationKey string = appInsights.outputs.instrumentationKey