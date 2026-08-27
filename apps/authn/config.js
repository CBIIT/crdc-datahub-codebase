const dotenv = require('dotenv')
const fs = require('fs');
const path = require('path');
const {isCaseInsensitiveEqual} = require("./util/string-util");
const {NIH} = require("./constants/idp-constants");
dotenv.config();

if (process.env.docdb_db_name) {
  process.env.DATABASE_NAME = process.env.docdb_db_name;
}

const DEFAULT_DOCUMENT_DB_CA_FILE = path.join(__dirname, 'resources/aws-documentdb-certificate/global-bundle.pem');
const documentDbTlsEnabled = process.env.DOCDB_TLS
    ? process.env.DOCDB_TLS.toLowerCase() === 'true'
    : true;
const documentDbCaFile = documentDbTlsEnabled
    ? (process.env.DOCDB_CA_FILE || DEFAULT_DOCUMENT_DB_CA_FILE)
    : null;

/**
 * Builds a MongoDB-compatible connection URI for DocumentDB.
 * Encodes user, password, and database for reserved URI characters.
 * When caFile is set, enables TLS and SCRAM-SHA-1. Always disables retryWrites.
 * @param {string} user
 * @param {string} password
 * @param {string} host
 * @param {string} port
 * @param {string} database
 * @param {string} [caFile]
 * @returns {string}
 */
function buildConnectionString(user, password, host, port, database, caFile) {
  const params = new URLSearchParams({
    authSource: 'admin',
    retryWrites: 'false',
  });
  if (caFile) {
    params.set('tls', 'true');
    params.set('tlsCAFile', caFile);
    params.set('authMechanism', 'SCRAM-SHA-1');
  }
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?${params.toString()}`;
}

/**
 * Builds the DocumentDB connection URI from docdb_* environment variables.
 * Port defaults to 27017 when docdb_port is unset. TLS is on when DOCDB_TLS
 * is unset or true. CA defaults to
 * resources/aws-documentdb-certificate/global-bundle.pem when DOCDB_CA_FILE
 * is unset. Throws on first URI access if required env vars are missing or
 * if TLS is on and the CA file is missing.
 * @returns {string}
 * @throws {Error} When required docdb_* environment variables are missing
 * @throws {Error} When TLS is enabled and the CA file does not exist
 */
function buildDocumentDbConnectionString() {
  const required = {
    docdb_endpoint: process.env.docdb_endpoint,
    docdb_username: process.env.docdb_username,
    docdb_password: process.env.docdb_password,
    docdb_db_name: process.env.docdb_db_name,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value || !String(value).trim())
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`DocumentDB connection is missing required environment variables: ${missing.join(', ')}`);
  }
  if (documentDbTlsEnabled && !fs.existsSync(documentDbCaFile)) {
    throw new Error(`DocumentDB TLS is enabled but CA file was not found: ${documentDbCaFile}`);
  }
  return buildConnectionString(
    process.env.docdb_username,
    process.env.docdb_password,
    process.env.docdb_endpoint,
    process.env.docdb_port || '27017',
    process.env.docdb_db_name,
    documentDbCaFile,
  );
}

const config = {
  version: process.env.VERSION,
  date: process.env.DATE,
  idp: process.env.IDP ? process.env.IDP.toLowerCase() : NIH,
  session_secret: process.env.SESSION_SECRET,
  session_timeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) * 1000 : 1000 * 30 * 60,  // 30 minutes
  document_db_tls: documentDbTlsEnabled,
  document_db_ca_file: documentDbCaFile,
  // NIH login settings
  nih: {
    CLIENT_ID: process.env.NIH_CLIENT_ID,
    CLIENT_SECRET: process.env.NIH_CLIENT_SECRET,
    BASE_URL: process.env.NIH_BASE_URL,
    REDIRECT_URL: process.env.NIH_REDIRECT_URL,
    USERINFO_URL: process.env.NIH_USERINFO_URL,
    AUTHORIZE_URL: process.env.NIH_AUTHORIZE_URL,
    TOKEN_URL: process.env.NIH_TOKEN_URL,
    LOGOUT_URL: process.env.NIH_LOGOUT_URL,
    SCOPE: process.env.NIH_SCOPE,
    PROMPT: process.env.NIH_PROMPT
  },
  // Disable local test page automatically sends /login request, so Postman can use the auth code
  noAutoLogin: process.env.NO_AUTO_LOGIN ? process.env.NO_AUTO_LOGIN.toLowerCase() === "true" : false,

  getIdpOrDefault: (idp) => {
    return (idp) ? idp : config.idp;
  },
  getUrlOrDefault: (idp, url) => {
    if (!url && isCaseInsensitiveEqual(idp,'NIH')) return process.env.NIH_REDIRECT_URL;
    return url;
  }
};

Object.defineProperty(config, 'document_db_connection_string', {
  enumerable: true,
  get() {
    return buildDocumentDbConnectionString();
  },
});

if (!config.version) {
  config.version = 'Version not set'
}

if (!config.date) {
  config.date = new Date();
}

module.exports = config;
