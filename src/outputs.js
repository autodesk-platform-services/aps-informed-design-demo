import ora from 'ora'; // command line spinner
import { promptChoice } from './prompts.js';
import { getDownloadUrl } from './downloads.js';
import { apiGet, apiPost } from './apiUtils.js';

async function createOutput(context) {
    let counter = 0;
    let choices = context.release.outputSettings.map(setting => { return { name: setting.type, value: ++counter } });
    let choice = await promptChoice("output type", choices);
    let outputType = choices[choice].name;
    let outputSetting = await getOutputSettings(context.release, outputType, choice);
    return await postOutput(context.variant, outputType, outputSetting, context.config, context.token);
}

async function getOutputSettings(release, type, settingIndex) {
    let outputSetting = release.outputSettings[settingIndex];
    let typeOutputSetting = {};
    // Prompt for representation if more than 1
    if (outputSetting.representations) {
        let choice = await promptChoice("Representation", outputSetting.representations.map(representation => { return { name: representation, value: representation } }));
        typeOutputSetting.representation = outputSetting.representations[choice];
    }

    switch (type) {
        case "RFA":
            typeOutputSetting.version = await getEngineVersion("Revit");
            break;
        default:
            // nothing else to add
            break;

    }
    return typeOutputSetting;
}

async function getEngineVersion(engineType) {
    const versions = [
        { name: "2024", value: "2024" },
        { name: "2025", value: "2025" },
        { name: "2026", value: "2026" },
    ];
    let choice = await promptChoice(engineType + " version", versions);
    return versions[choice].name;
}

async function getOutputs(config, variant, token) {
    const accessId = config.accessId;
    const variantId = variant.id;
    const outputsEndpoint = config.baseUrl + "/outputs?accessType=" + config.accessType + "&accessId=" + accessId + "&filter[variantId]=" + variantId;

    const res = await apiGet(outputsEndpoint, token);

    if (!res.ok) {
        const text = await res.text();
        console.error("Error retrieving outputs: ", res.status, res.statusText);
        console.error(text);
        throw new Error(`Error retrieving outputs: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.results;
}

async function postOutput(variant, type, outputSetting, config, token) {
    const variantId = variant.id;
    const accessId = config.accessId;
    const variantsEndpoint = config.baseUrl + "/outputs?accessType=" + config.accessType + "&accessId=" + accessId;
    const res = await apiPost(variantsEndpoint, token, {
        variantId: variantId,
        outputs: [
            {
                type: `${type}`,
                settings: outputSetting
            }
        ]
    });
    const data = await res.json();

    // Demo is just showing one ouptut but this could be multiple outputs
    return await waitForOutputResult(data.outputs[0].id, config, token);
}

async function getOutputStatus(outputId, config, token) {
    const accessId = config.accessId;
    const outputsEndpoint = config.baseUrl + "/outputs/" + outputId + "?accessType=" + config.accessType + "&accessId=" + accessId;

    const res = await apiGet(outputsEndpoint, token);

    const data = await res.json();
    //console.log(data);
    return data
}

async function waitForOutputResult(outputId, config, token) {
    let result = false;
    //let status = "PENDING";
    const spinner = ora('Waiting for output').start();
    let loopCount = 0;
    let output = {};
    while (!result) {
        if (loopCount > 2000) {
            // Give up after so many tries
            break;
        }
        loopCount++;

        setTimeout(() => {
            spinner.color = 'yellow';
            spinner.text = 'Waiting for output';
        }, 5000);
        output = await getOutputStatus(outputId, config, token);
        result = (output.status === "SUCCESS");
    }

    const status = output.status;
    switch (status) {
        case "SUCCESS":
            spinner.succeed("output created: " + status)
            break;
        case "PENDING":
            spinner.warn("output still pending, timed out: " + status);
            process.exit(1);
        case "FAILED":
            spinner.fail("output failed: " + status);
            process.exit(1);
        default:
            spinner.fail("output status unknown: " + status);
            process.exit(1);
    }
    spinner.stop();
    return output;
}

async function handleOutputUpdate(updateType, context) {
    switch (updateType) {
        case "CREATE":
            return await createOutput(context);
        default:
            console.log("Unsupported type: " + updateType);
    }
    process.exit(1);
}

// OUTPUT OPTIONS (UPLOAD, DOWNLOAD, DELETE)
const outputOptions = [
    { name: "Download URL", value: "DOWNLOAD" },
    // { name: "Upload", value: "UPLOAD" },
    // { name: "Delete", value: "DELETE" }
];

async function handleOutputOptions(updateType, context) {
    switch (updateType) {
        case 0: // DOWNLOAD
            const downloadUrl = await getDownloadUrl(context.config, context.output, context.token);
            console.log(downloadUrl);
            break;
        case 1: // UPLOAD
            console.log("implement upload");
            break;
        default:
            console.log("unsupported output option: " + updateType);
            break;
    }
}

const outputToName = (output) => {
    let name = output.type;
    let suffix = []
    if (output.settings.representation) {
        suffix.push(output.settings.representation);
    }

    if (output.settings.version) {
        suffix.push(output.settings.version);
    }

    if (suffix !== "") {
        name += " (" + suffix.join("-") + ")";
    }

    return name;
}

export { outputOptions, getOutputs, createOutput, handleOutputUpdate, handleOutputOptions, outputToName };

