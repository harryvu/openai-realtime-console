// Application Insights module for application monitoring

@description('Name of the Application Insights resource')
param appInsightsName string

@description('Location for Application Insights')
param location string

@description('Log Analytics Workspace ID to connect to')
param logAnalyticsWorkspaceId string

@description('Application type')
@allowed(['web', 'java', 'HockeyAppBridge', 'other'])
param applicationType string = 'web'

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: applicationType
  properties: {
    Application_Type: applicationType
    Flow_Type: 'Bluefield'
    Request_Source: 'rest'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// Create custom performance counters and metrics
resource webTestAvailability 'Microsoft.Insights/webtests@2022-06-15' = {
  name: '${appInsightsName}-availability-test'
  location: location
  kind: 'ping'
  properties: {
    SyntheticMonitorId: '${appInsightsName}-availability-test'
    Name: 'Citizenship Test App Availability'
    Description: 'Availability test for the Citizenship Test application'
    Enabled: true
    Frequency: 300 // 5 minutes
    Timeout: 120   // 2 minutes
    Kind: 'ping'
    RetryEnabled: true
    Locations: [
      {
        Id: 'us-ca-sjc-azr' // West US
      }
      {
        Id: 'us-va-ash-azr' // East US
      }
    ]
    Configuration: {
      WebTest: '<WebTest Name="Citizenship Test Availability" Id="ABD48585-0831-40CB-9069-682A25A54A19" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="120" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale=""><Items><Request Method="GET" Guid="a5f10126-e4cd-570d-961c-cea43999a200" Version="1.1" Url="{{Url}}/health" ThinkTime="0" Timeout="120" ParseDependentRequests="False" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" /></Items></WebTest>'
    }
  }
  dependsOn: [
    appInsights
  ]
}

output instrumentationKey string = appInsights.properties.InstrumentationKey
output connectionString string = appInsights.properties.ConnectionString
output appInsightsId string = appInsights.id
output appInsightsName string = appInsights.name