# CRDC AuthN/AuthZ service

## Environmental Variables 
Following environmental variables are needed

- VERSION : version number
- DATE : build date
- IDP : default identification provider, enabled if IDP is not provided from the client side e.g., "nih" 
- SESSION_SECRET : secret used to sign cookies
- SESSION_TIMEOUT : session timeout in seconds, default is 30 minutes

# Testing
- TEST_EMAIL : The email to be logged in if "test-idp" is specified as the IDP
 
# DocumentDB configuration
- DOCDB_ENDPOINT : The host URL of the DocumentDB cluster
- DOCDB_PORT : The port of the DocumentDB cluster (default 27017)
- DOCDB_USERNAME : The service user of the DocumentDB cluster
- DOCDB_PASSWORD : The password for the service user
- DOCDB_DB_NAME : The database name
- DOCDB_TLS : `true` or `false` only. Unset is treated as `true`. Set `false` for local MongoDB without TLS
- DOCDB_CA_FILE : Optional path to the DocumentDB CA bundle. Defaults to resources/aws-documentdb-certificate/global-bundle.pem. For local TLS, download the AWS global bundle to that path or set this override.
 
# NIH login configuration
- NIH_CLIENT_ID: NIH login server client id
- NIH_CLIENT_SECRET: NIH login client secret
- NIH_BASE_URL: NIH login server url
- NIH_REDIRECT_URL: redirecting url after successful authentication
- NIH_USERINFO_URL: NIH API address to search user information
- NIH_AUTHORIZE_URL: NIH API address to authenticate for login
- NIH_TOKEN_URL: NIH API address to create token for login
- NIH_LOGOUT_URL: NIH API address to invalidate token for logout
- NIH_SCOPE: space-separated lists of identifiers to specify access privileges
- NIH_PROMPT: to force re-authorization event when a current session is still active

# Local development configuration
- NODE_ENV: If set to "development", a test html page will be activated in the route "/"
- NO_AUTO_LOGIN: If set to "true", local test page will only display authorization codes, instead of calling /login automatically