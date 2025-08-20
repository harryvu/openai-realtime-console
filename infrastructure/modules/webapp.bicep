// Web App module for the US Citizenship Test Assistant

@description('Name of the web app')
param webAppName string

@description('Location for the web app')
param location string

@description('App Service Plan ID')
param appServicePlanId string

@description('Container registry URL')
param containerRegistryUrl string

@description('Docker image name')
param dockerImageName string

@description('PostgreSQL connection string')
@secure()
param postgresConnectionString string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Application Insights instrumentation key')
param appInsightsInstrumentationKey string

@description('Key Vault name for secrets')
param keyVaultName string

@description('OpenAI API key')
@secure()
param openaiApiKey string

@description('Session secret')
@secure()
param sessionSecret string

@description('Environment (production, staging)')
@allowed(['production', 'staging'])
param environment string

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlanId
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerRegistryUrl}/${dockerImageName}:latest'
      alwaysOn: environment == 'production'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      webSocketsEnabled: true
      requestTracingEnabled: true
      httpLoggingEnabled: true
      logsDirectorySizeLimit: 50
      detailedErrorLoggingEnabled: true
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'DATABASE_URL'
          value: postgresConnectionString
        }
        {
          name: 'OPENAI_API_KEY'
          value: openaiApiKey
        }
        {
          name: 'SESSION_SECRET'
          value: sessionSecret
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsightsInstrumentationKey
        }
        {
          name: 'APPINSIGHTS_PROFILERFEATURE_VERSION'
          value: '1.0.0'
        }
        {
          name: 'APPINSIGHTS_SNAPSHOTFEATURE_VERSION'
          value: '1.0.0'
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_Mode'
          value: 'Recommended'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_PreemptSdk'
          value: 'Disabled'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${containerRegistryUrl}'
        }
        {
          name: 'DOCKER_ENABLE_CI'
          value: 'true'
        }
        {
          name: 'WEBSITE_HTTPLOGGING_RETENTION_DAYS'
          value: '3'
        }
        {
          name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
          value: 'true'
        }
      ]
      connectionStrings: [
        {
          name: 'DefaultConnection'
          connectionString: postgresConnectionString
          type: 'PostgreSQL'
        }
      ]
    }
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    keyVaultReferenceIdentity: 'SystemAssigned'
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// Configure logging
resource webAppLogs 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'logs'
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 7
        retentionInMb: 50
      }
    }
    failedRequestsTracing: {
      enabled: true
    }
    detailedErrorMessages: {
      enabled: true
    }
  }
}

// Configure health check
resource healthCheck 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'web'
  properties: {
    healthCheckPath: '/health'
  }
}

// Configure auto-healing rules
resource autoHeal 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'web'
  properties: {
    autoHealEnabled: true
    autoHealRules: {
      triggers: {
        requests: {
          count: 100
          timeInterval: '00:05:00'
        }
        slowRequests: {
          timeTaken: '00:01:00'
          count: 10
          timeInterval: '00:05:00'
        }
      }
      actions: {
        actionType: 'Recycle'
        minProcessExecutionTime: '00:01:00'
      }
    }
  }
  dependsOn: [
    healthCheck
  ]
}

output webAppName string = webApp.name
output webAppId string = webApp.id
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output principalId string = webApp.identity.principalId