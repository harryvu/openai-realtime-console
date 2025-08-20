// App Service Plan module for hosting the web application

@description('Name of the App Service Plan')
param planName string

@description('Location for the App Service Plan')
param location string

@description('Environment (production, staging)')
@allowed(['production', 'staging'])
param environment string

@description('SKU for the App Service Plan')
param sku object = environment == 'production' ? {
  name: 'P1v3'
  tier: 'PremiumV3'
  size: 'P1v3'
  family: 'Pv3'
  capacity: 1
} : {
  name: 'B1'
  tier: 'Basic'
  size: 'B1'
  family: 'B'
  capacity: 1
}

@description('Operating system for the App Service Plan')
@allowed(['Windows', 'Linux'])
param os string = 'Linux'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  kind: os == 'Linux' ? 'linux' : ''
  properties: {
    reserved: os == 'Linux'
    targetWorkerCount: sku.capacity
    targetWorkerSizeId: 0
  }
  sku: sku
}

output planId string = appServicePlan.id
output planName string = appServicePlan.name