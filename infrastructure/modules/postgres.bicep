// PostgreSQL Flexible Server module with pgvector extension

@description('Name of the PostgreSQL server')
param serverName string

@description('Location for the PostgreSQL server')
param location string

@description('Administrator login username')
@secure()
param administratorLogin string

@description('Administrator login password')
@secure()
param administratorPassword string

@description('Environment (production, staging)')
@allowed(['production', 'staging'])
param environment string

@description('PostgreSQL version')
@allowed(['11', '12', '13', '14', '15', '16'])
param postgresVersion string = '15'

@description('SKU for the PostgreSQL server')
param sku object = environment == 'production' ? {
  name: 'Standard_B2s'
  tier: 'Burstable'
} : {
  name: 'Standard_B1ms'
  tier: 'Burstable'
}

@description('Storage size in GB')
param storageSizeGB int = environment == 'production' ? 128 : 32

@description('Database name')
param databaseName string = 'citizenship_db'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: serverName
  location: location
  sku: sku
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
      tier: 'P4'
    }
    backup: {
      backupRetentionDays: environment == 'production' ? 7 : 3
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    maintenanceWindow: {
      customWindow: 'Disabled'
      dayOfWeek: 0
      startHour: 0
      startMinute: 0
    }
    replicationRole: 'Primary'
  }
}

// Create database
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Enable pgvector extension
resource pgvectorExtension 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: postgresServer
  name: 'shared_preload_libraries'
  properties: {
    value: 'vector'
    source: 'user-override'
  }
}

// Configure Azure AD authentication
resource azureADAuth 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-12-01-preview' = {
  parent: postgresServer
  name: 'azure.extensions'
  properties: {
    value: 'vector'
    source: 'user-override'
  }
}

// Firewall rule to allow Azure services
resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Firewall rule to allow all IPs (for development - consider restricting in production)
resource allowAllIPs 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = if (environment != 'production') {
  parent: postgresServer
  name: 'AllowAllIPs'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

output serverName string = postgresServer.name
output serverId string = postgresServer.id
output serverFQDN string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output connectionString string = 'postgresql://${administratorLogin}:${administratorPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'