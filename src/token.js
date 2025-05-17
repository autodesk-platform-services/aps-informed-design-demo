import fs from "fs";
import jwt from 'jsonwebtoken';
import fetch from "node-fetch";

// Creates a JWT token using Autodesk Secure Service Account (https://aps.autodesk.com/en/docs/ssa/v1)
async function createToken(config) {
  const ssaData = JSON.parse(fs.readFileSync(`./accounts/${config.serviceAccountName}.json`, "utf8"));
  validateSSAData(ssaData);

  const accountId = ssaData.serviceAccountId;

  const jwtAssertion = createJwtAssertion(
    ssaData.kid,
    ssaData.privateKey,
    config.credentials.clientId,
    accountId,
    config.tokenScope
  );

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': getBasicAuthHeader(config.credentials.clientId, config.credentials.clientSecret)
  };

  const payload = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwtAssertion,
    scope: config.tokenScope,
  });

  const token = await fetch(`https://developer.api.autodesk.com/authentication/v2/token`, {
    method: "POST",
    headers: headers,
    body: payload
  });

  const tokenData = await token.json();
  if (!tokenData || !tokenData.access_token || tokenData.error) {
    console.error("Error: No access token received");
    process.exit(1);
  }

  return tokenData.access_token;
}

function validateSSAData(ssaData) {
  if (!ssaData) {
    console.error("Error: No service account data found");
    process.exit(1);
  }

  let errMsg = "";

  if (!ssaData.serviceAccountId) {
    errMsg += "\n - No service account ID found";
  }

  if (!ssaData.kid) {
    errMsg += "\n - No key ID found";
  }

  if (!ssaData.privateKey) {
    errMsg += "\n - No private key found";
  }

  if (errMsg) {
    errMsg = "Error: The Service account JSON file is missing some required data." + errMsg;
    console.error(errMsg);
    process.exit(1);
  }
}

function createJwtAssertion(kid, privateKey, clientId, oxygenId, scope) {
  privateKey = privateKey.replace(/\\n/g, "\n");

  const currentTime = Math.floor(Date.now() / 1000);
  const expirationTime = currentTime + 300; // 5 minutes from now

  const claims = {
    iss: clientId,
    sub: oxygenId,
    aud: "https://developer.api.autodesk.com/authentication/v2/token",
    exp: expirationTime,
    scope: scope.split(" "),
  };

  const jwtHeader = {
    alg: "RS256",
    kid: kid,
  };

  // Encode the JWT
  const jwtAssertion = jwt.sign(claims, privateKey, {
    algorithm: "RS256",
    header: jwtHeader,
  });
  return jwtAssertion;
}

function getBasicAuthHeader(clientId, clientSecret) {
  const authString = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(authString).toString("base64")}`;
}

export { createToken };