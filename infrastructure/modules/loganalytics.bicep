// Log Analytics Workspace module

@description('Name of the Log Analytics workspace')
param workspaceName string

@description('Location for the workspace')
param location string

@description('SKU for the workspace')
@allowed(['PerGB2018', 'Free', 'Standalone', 'PerNode', 'Premium'])
param sku string = 'PerGB2018'

@description('Data retention in days')
@minValue(30)
@maxValue(730)
param retentionInDays int = 30

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: sku
    }
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = logAnalyticsWorkspace.id
output workspaceName string = logAnalyticsWorkspace.name
output customerId string = logAnalyticsWorkspace.properties.customerId