# Informed Design API Sample App

Simple command line nodejs demo app for the Informed Design API

This App enables you to perform operations on the Informed Design API - Including creating and accessing products, releases, variants and outputs.

## Step 1: SSA Setup

Follow the steps located at the [Informed Design API Step-By-Step tutorial](https://aps.autodesk.com/en/docs/informed-design/v1/tutorials/before_you_begin/) to learn about how to create an APS app and a Secure Service Account.

You can also use the SSA manager located at https://ssa-manager.autodesk.io/ to generate a service account and retrieve the required keys.


## Step 2: Configuration

- Create the configuration file (inf-config.json) for the app
- Add the SSA key details to the **accounts** folder

### ind-config.json file
```
{
    "credentials": {
        "clientId": "<The APS App Client ID>",
        "clientSecret": "<APS App Client Secret>"
    },
    "baseUrl": "https://developer.api.autodesk.com/industrialized-construction/informed-design/v1",
    "delimiter": "|",
    "serviceAccountName": "<The name of the service account>",
    "accessType": "ACC",
    "tokenScope": "data:read data:write data:create account:read"
}
```

### SSA Key Details
- Create a json file in accounts folder named "{{serviceAccountName}}.json" (file path: "./accounts/{{serviceAccountName}}.json")
- Add the information from the Key Details as well as service account Id and email to the json file

```
{
    "serviceAccountId": "<The Service Account Id>",
    "email": "<The Service Account Email>",
    "kid": "<Key ID>",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n ... \n-----END RSA PRIVATE KEY-----\n"
}
```

## Step 3: Run the App

> Prereq: node >= v18

- Install dependencies: `npm install`
- Start the app: `npm start`

## Debugging with VSCode
To debug the app with VS code

- Add the following `Attach by Process ID` configuration to VS code launch config
```
{
    "name": "Attach by Process ID",
    "processId": "${command:PickProcess}",
    "request": "attach",
    "skipFiles": [
    "<node_internals>/**"
    ],
    "type": "node"
}
```
- Start the App (see Step 3)
- Start Debugging and select the Process ID for your terminal


## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.