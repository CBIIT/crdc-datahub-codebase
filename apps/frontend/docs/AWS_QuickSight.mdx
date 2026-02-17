# Overview

This document provides developer documentation on the CRDC Submission Portal – AWS QuickSight migration.

Refer to [Migrate Amazon QuickSight across AWS accounts](https://aws.amazon.com/blogs/big-data/migrate-amazon-quicksight-across-aws-accounts) for more information.

# Dataset

To list the available datasets

```bash
aws quicksight list-data-sets --aws-account-id 7XXXXXXXXXX1
```

# Dashboard

To get the full definition of a dashboard,

```bash
aws quicksight describe-dashboard-definition --aws-account-id 7XXXXXXXXXX1 --dashboard-id "UUID-GOES-HERE"
```

With the above command, we can see the full definition of the dashboard. This includes the filters, parameters, and other settings. This can be useful for building a new dashboard programmatically.

# Dashboard to Template

To create a new template, start by listing the available dashboards in the account. This will give us the dashboard details we need to create a new template.

```bash
aws quicksight list-dashboards --aws-account-id 7XXXXXXXXXX1
```

From the output, look for the `DashboardId` that we want to use as a template. With that, we need to run the `describe-dashboard` command,

```bash
aws quicksight describe-dashboard --aws-account-id 7XXXXXXXXXX1 --dashboard-id "UUID-GOES-HERE" > DESCRIBED_DASHBOARD.json
```

The above command will store the output in a file called `DESCRIBED_DASHBOARD.json`. We will need portions of this output to create a new template.

We need to create another JSON file that will contain the template definition. The following is an example of a template definition.
For simplicity, it's recommended to put this in a new JSON file (e.g. `CREATE_TEMPLATE_INPUT.json`).

```json
{
  "AwsAccountId": "7XXXXXXXXXX1",
  "TemplateId": "UUID OR TEXT HERE",
  "Name": "VISUAL NAME OF THE TEMPLATE",
  "SourceEntity": {
    "SourceAnalysis": {
      "Arn": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:analysis/UUID-GOES-HERE",
      "DataSetReferences": [
        {
          "DataSetPlaceholder": "DatasetTemplateNameHere",
          "DataSetArn": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:dataset/UUID-GOES-HERE"
        }
      ]
    }
  },
  "VersionDescription": "1"
}
```

The following command will create a new template from the dashboard we just described.

```bash
aws quicksight create-template --aws-account-id 7XXXXXXXXXX1 --cli-input-json file://./CREATE_TEMPLATE_INPUT.json > CREATE_TEMPLATE_OUTPUT.json
```

After running the above command, you should see a response similar to the following stored in the `CREATE_TEMPLATE_OUTPUT.json` file:

```json
{
  "TemplateArn": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:template/UUID-GOES-HERE",
  "TemplateId": "UUID-GOES-HERE",
  "Status": 201
}
```

# Template-Based Migration

To migrate a template across QuickSight accounts, we need to adjust the template permissions.

The following JSON file (e.g. `TEMPLATE_PERMISSIONS.json`) will be used to update the template permissions.

```json
[
  {
    "Principal": "arn:aws:quicksight:7XXXXXXXXXX1:root",
    "Actions": [
      "quicksight:UpdateTemplatePermissions",
      "quicksight:DescribeTemplate"
    ]
  }
]
```

With the above file, execute the following command to update the template permissions.

```bash
aws quicksight update-template-permissions --aws-account-id 7XXXXXXXXXX1 --template-id "XXXX" --grant-permissions file://./TEMPLATE_PERMISSIONS.json
```

# Template to Dashboard

Now that we have the template created from a dashboard, we can list the available templates. You may skip this step if you already know the template ID (given by the previous command).

```bash
aws quicksight list-templates --aws-account-id 7XXXXXXXXXX1
```

With a template ID, we can now describe the template. This will give us the ARN we need to create a new dashboard.

```bash
aws quicksight describe-template --aws-account-id 7XXXXXXXXXX1 --template-id "submissions-X-X-X" > DESCRIBED_TEMPLATE.json
```

The above command will store the output in a file called `DESCRIBED_TEMPLATE.json`. We will need portions of this output to create a new dashboard.

The following is an example of an dashboard definition.

```json
{
  "AwsAccountId": "7XXXXXXXXXX1",
  "DashboardId": "UUID or TEXT HERE",
  "Name": "VISUAL NAME OF THE DASHBOARD",
  "Permissions": [
    {
      "Principal": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:user/default/XXXXXXX",
      "Actions": [
        "quicksight:DescribeDashboard",
        "quicksight:ListDashboardVersions",
        "quicksight:UpdateDashboardPermissions",
        "quicksight:QueryDashboard",
        "quicksight:UpdateDashboard",
        "quicksight:DeleteDashboard",
        "quicksight:DescribeDashboardPermissions",
        "quicksight:UpdateDashboardPublishedVersion"
      ]
    }
  ],
  "SourceEntity": {
    "SourceTemplate": {
      "DataSetReferences": [
        {
          "DataSetPlaceholder": "DatasetTemplateNameHere",
          "DataSetArn": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:dataset/UUID-GOES-HERE"
        }
      ],
      "Arn": "arn:aws:quicksight:us-east-1:7XXXXXXXXXX1:template/submissions-X-X-X"
    }
  },
  "VersionDescription": "1",
  "DashboardPublishOptions": {
    "AdHocFilteringOption": {
      "AvailabilityStatus": "DISABLED"
    },
    "ExportToCSVOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "SheetControlsOption": {
      "VisibilityState": "COLLAPSED"
    },
    "SheetLayoutElementMaximizationOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "VisualMenuOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "VisualAxisSortOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "ExportWithHiddenFieldsOption": {
      "AvailabilityStatus": "DISABLED"
    },
    "DataPointDrillUpDownOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "DataPointMenuLabelOption": {
      "AvailabilityStatus": "ENABLED"
    },
    "DataPointTooltipOption": {
      "AvailabilityStatus": "ENABLED"
    }
  }
}
```

With the above definition, we can now create a new dashboard. The following command will create a new dashboard from the template we just described.

```bash
aws quicksight create-dashboard --cli-input-json file://./CREATE_DASHBOARD_INPUT.json --aws-account-id 7XXXXXXXXXX1 > CREATE_DASHBOARD_OUTPUT.json
```

> [!NOTE]
> You can retrieve the Principal ARN by listing your QuickSight users.
>
> ```bash
> aws quicksight list-users --aws-account-id 7XXXXXXXXXX1 --namespace default
> ```
