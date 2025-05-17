import fs from "fs";
import { promptConfirm, promptInput, promptJsonInput, doProgress } from './prompts.js';
import { isFilePath } from './fileUtils.js';
import { apiGet, apiPost } from './apiUtils.js';
import { uploadFile } from './data.js';

async function getReleases(config, productId, token) {
  const accessId = config.accessId;
  const releasesEndpoint = config.baseUrl + "/releases?accessType=" + config.accessType + "&accessId=" + accessId + "&productId=" + productId + "&limit=10&offset=0";

  const res = await apiGet(releasesEndpoint, token);

  if (!res.ok) {
    const text = await res.text();
    console.error("Error retrieving releases: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error retrieving releases: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.results;
}

async function createRelease(context) {
  console.log("Provide properties for the new release");

  const choice = await await promptConfirm("Do you have a json file for the Release payload?");

  let newRelease = null;
  if (choice) {
    newRelease = await inputFromFileToPayload(context);
  } else {
    newRelease = await inputsFromConsoleToPayload(context);
  }

  return await postRelease(context.config, context.token, newRelease);
}

async function inputFromFileToPayload(context) {
  console.log("The Json file must contain a valid Release request body.");
  console.log("See \"POST Create Release\" in the API documentation or \"release.sample.json\" in the samples folder.");

  const filePath = await promptInput(">>> Enter path to Json file.");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (!data.authoringAppVersion || !data.dataSetLocation || !data.thumbnails || !data.sourceContext || !data.parameters || !data.outputSettings) {
    throw new Error("The Json file must contain a valid Release request body.\nFor Release payload, see \"POST Create Release\" in the API documentation: https://aps.autodesk.com/en/docs/informed-design/v1/reference/quick_reference/informed-design-api-postreleases-POST/");
  }

  // convert local file to objectKey if applicable
  if (data.dataSetLocation && isFilePath(data.dataSetLocation)) {
    const filePath = data.dataSetLocation;
    data.dataSetLocation = await doProgress(`Uploading ${filePath} ...`, () => uploadFile(context, filePath));
    console.log(`Uploaded ${filePath} to API with objectKey: ${data.dataSetLocation}`);
  }

  // convert local file thumbnails to objectKey if applicable
  if (data.thumbnails) {
    for (const thumbnail of data.thumbnails) {
      if (isFilePath(thumbnail.thumbnail)) {
        const filePath = thumbnail.thumbnail;
        thumbnail.thumbnail = await doProgress(`Uploading ${filePath} ...`, () => uploadFile(context, filePath));
        console.log(`Uploaded ${filePath} to API with objectKey: ${thumbnail.thumbnail}`);
      }
    }
  }

  const releaseNotes = await promptInput(`>>> releaseNotes (default: ${data.notes})`);
  if (!(!releaseNotes || releaseNotes === "")) {
    data.notes = releaseNotes;
  }

  data.productId = context.product.id;
  data.state = "ACTIVE";
  data.isConfigurable = !!data.isConfigurable ? data.isConfigurable : true;

  return data;
}

async function inputsFromConsoleToPayload(context) {
  const authoringAppVersion = await promptInput('>>> authoringAppVersion (e.g. 2025)');
  const releaseNotes = await promptInput('>>> releaseNotes');
  const datasetLocation = await promptDatasetLocation(context);

  const sourceContext = await promptJsonInput(`>>> sourceContext (as an object)
    e.g.
    {
      "project": "\\Wall.ipj",
      "baseModel": "Wall\\Wall Assembly.iam"
    }`);

  const thumbnails = await promptThumbnails(context);

  const parameters = await promptJsonInput(`>>> parameters (as an array)
    e.g.
      [{
            "name": "Height",
            "type": "NUMERIC",
            "defaultValue": 50,
            "unit": "in",
            "isInput": true,
            "allowCustomValue": true
        },
        {
            "name": "Width",
            "type": "NUMERIC",
            "defaultValue": 100,
            "unit": "in",
            "isInput": true,
            "allowCustomValue": true
    }]`);

  const outputSettings = await promptJsonInput(`>>> outputSettings (as an array)
    e.g.
    [{
          "type": "BOM",
          "representations": [
              "[Primary]",
              "Medium"
          ]
      },
      {
          "type": "INV"
      }]
  `);

  const data = {
    productId: context.product.id,
    state: "ACTIVE",
    isConfigurable: true,
    authoringAppVersion: authoringAppVersion,
    notes: releaseNotes,
    dataSetLocation: datasetLocation,
    thumbnails: thumbnails,
    sourceContext: sourceContext,
    parameters: parameters,
    outputSettings: outputSettings
  };

  return data;
}

async function promptDatasetLocation(context) {
  let objectKey = null;

  while (true) {
    const input = await promptInput('>>> dataSetLocation (Object key or Path to Zip file)');
    objectKey = input;

    // check if input is local file path
    if (isFilePath(input)) {
      if (!input.endsWith(".zip")) {
        console.error("Error: The file must be a zip file");
        continue;
      } else {
        const filePath = input;
        objectKey = await doProgress(`Uploading ${filePath} ...`, () =>  uploadFile(context, filePath));
        console.log(`Uploaded ${filePath} to API with objectKey: ${objectKey}`);
      }
    }

    break;
  }

  return objectKey;
}

async function promptThumbnails(context) {
  while (true) {
    const thumbnails = await promptJsonInput(`>>> thumbnails (as an array)
    e.g.
    [{ 
      "representation": "[Primary]", 
      "thumbnail": "ObjectKey or File Path"
      }
    ]`);

    if (!Array.isArray(thumbnails)) {
      console.error("Error: The content of thumbnails must be an array");
      continue;
    }

    for (const thumbnail of thumbnails) {
      if (isFilePath(thumbnail.thumbnail)) {
        const filePath = thumbnail.thumbnail;
        thumbnail.thumbnail = await doProgress(`Uploading ${filePath} ...`, () =>  uploadFile(context, filePath));
        console.log(`Uploaded ${filePath} to API with objectKey: ${thumbnail.thumbnail}`);
      }
    }

    return thumbnails;
  }
}

async function postRelease(config, token, releaseData) {
  const accessId = config.accessId;
  const releasesEndpoint = config.baseUrl + "/releases?accessType=" + config.accessType + "&accessId=" + accessId;
  console.log("releaseEndpoint: " + releasesEndpoint);
  console.log(releaseData);

  const res = await apiPost(releasesEndpoint, token, releaseData);

  if (!res.ok) {
    const text = await res.text();
    console.error("Error creating release: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error creating release: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  console.log("Release created successfully");
  return data;
}

async function handleReleaseUpdate(updateType, context) {
  switch (updateType) {
    case "CREATE":
      return await createRelease(context);
    default:
      console.log("unsupported option: " + updateType);
      break;
  }

  process.exit(1);
}

export { getReleases, handleReleaseUpdate };