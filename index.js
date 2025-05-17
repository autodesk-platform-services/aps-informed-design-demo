import fs from "fs";
import { createToken } from './src/token.js';
import { promptChoice, promptAcc, itemFromChoice, promptConfirm, doProgress } from './src/prompts.js';
import { getAccessId, getAccounts, getProjects, getFolders, getProjectFolders } from './src/access.js';
import { getProducts, handleProductUpdate } from "./src/products.js";
import { getReleases, handleReleaseUpdate } from "./src/releases.js";
import { getVariants, variantNameWithParams, handleVariantUpdate } from "./src/variants.js";
import { getOutputs, handleOutputUpdate, handleOutputOptions, outputOptions, outputToName } from "./src/outputs.js";
import { error } from "console";

console.log("\n===== Informed Design API Demo =====\n");

// Setup globals and get config info
const globals = {};
const config = JSON.parse(fs.readFileSync('./ind-config.json', "utf8"));
validateConfig(config);
globals.token = await createToken(config);
if (!globals.token) {
  throw error('Could not create auth token');
}
console.log(">> Token created successfully");

// Prompt for Account
let accounts = await doProgress("Fetching accounts ...", () => getAccounts(globals.token));
globals.account = await promptAcc("Account", accounts);

// Prompt for Project
let projects = await doProgress("Fetching projects ...", () => getProjects(globals.account, globals.token));
globals.project = await promptAcc("Project", projects);

// Browse and select a folder
let folderPath = [];
let folders = await doProgress("Fetching folders ...", () => getFolders(globals.account, globals.project, globals.token));
let browseSubFolders = true;

while (browseSubFolders) {
  if (folderPath.length > 0) {
    folders.push({ id: "BACK", attributes: { name: "<< Back" } });
  }
  const folderId = await promptAcc("Folder", folders);

  if (folderId === "BACK") {
    folderPath.pop();
    const parent = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;

    if (parent) {
      folders = await doProgress("Fetching folders ...", () => getProjectFolders(parent.id, globals.project, globals.token));
    } else {
      folders = await doProgress("Fetching folders ...", () => getFolders(globals.account, globals.project, globals.token));
    }
  } else {
    folderPath.push(folders.find(f => f.id === folderId));

    browseSubFolders = await promptConfirm("Browse Subfolders?");
    if (browseSubFolders) {
      const subFolders = await doProgress("Fetching folders ...", () => getProjectFolders(folderId, globals.project, globals.token));
      folders = subFolders;
    }
    else {
      browseSubFolders = false;
      globals.folder = folderId;
    }
  }
}

console.log(">> Selected folder Path: >>" + folderPath.map(folder => folder.attributes.name).join("/") + "<<");


// Setup context for accessing Informed Design API
config.accessId = await getAccessId(globals.project, globals.folder, config.delimiter);
const context = {
  config: config,
  project: globals.project,
  folder: globals.folder,
  token: globals.token
};

// PRODUCTS
globals.products = await doProgress(">> Fetching Products ...", () => getProducts(config, globals.token));
const selectedProduct = await promptChoice("Product", globals.products, handleProductUpdate, context);
const product = itemFromChoice(selectedProduct, globals.products);
context.product = product;

console.log(context.product);

// RELEASES
globals.releases = await doProgress(">> Fetching Releases ...", () => getReleases(config, product.id, globals.token));
const selectedRelease = await promptChoice("Release", globals.releases.map(release => { return { name: release.number } }), handleReleaseUpdate, context);
const release = itemFromChoice(selectedRelease, globals.releases);
context.release = release;

console.log(context.release);

// VARIANTS
globals.variants = await doProgress(">> Fetching Variants ...", () => getVariants(config, release.id, globals.token));
let choice = await promptChoice("Variant", globals.variants.map(variant => { return { name: variantNameWithParams(variant) } }), handleVariantUpdate, context);
const variant = itemFromChoice(choice, globals.variants);
context.variant = variant;

console.log(context.variant);

// OUTPUTS
globals.outputs = await doProgress(">> Fetching Outputs ...", () => getOutputs(config, variant, globals.token));
choice = await promptChoice("Output", globals.outputs.map(output => { return { name: outputToName(output) } }), handleOutputUpdate, context);
const output = itemFromChoice(choice, globals.outputs);
context.output = output;

console.log(context.output);

const outputChoice = await promptChoice("Options", outputOptions, handleOutputOptions, context, false);

function validateConfig(config) {
  let errMsg = "";

  if (config.baseUrl === undefined) {
    errMsg += '\n- Base URL';
  }

  if (config.accessType === undefined) {
    errMsg += '\n- Access Type';
  }

  if (config.delimiter === undefined) {
    errMsg += '\n- Delimiter';
  }

  if (!config.serviceAccountName) {
    errMsg += '\n- Service Account Name';
  }

  if (!config.tokenScope) {
    errMsg += '\n- Token Scope';
  }

  if (errMsg) {
    console.error("Error: Missing configuration values: " + errMsg + "\nPlease check your ind-config.json file.");
    process.exit(1);
  }
}