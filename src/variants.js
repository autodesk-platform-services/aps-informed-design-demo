import { apiGet, apiPost } from './apiUtils.js';
import { promptInput } from './prompts.js';

async function getVariants(config, releaseId, token) {
  const accessId = config.accessId;
  const variantsEndpoint = config.baseUrl + "/variants?accessType=" + config.accessType + "&accessId=" + accessId + "&releaseId=" + releaseId + "&limit=100&offset=0";
  const res = await apiGet(variantsEndpoint, token);

  if (!res.ok) {
    const text = await res.text();
    console.error("Error retrieving variants: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error retrieving variants: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.results;
}

async function postVariant(variantName, variantInputs, release, config, token) {
  const accessId = config.accessId;
  const variantsEndpoint = config.baseUrl + "/variants?accessType=" + config.accessType + "&accessId=" + accessId;

  const res = await apiPost(variantsEndpoint, token, {
    releaseId: release.id,
    name: variantName,
    inputs: variantInputs
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Error creating variant: ", res.status, res.statusText);
    console.error(text);
    throw new Error(`Error creating variant: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}

function variantNameWithParams(variant) {
  let variantName = variant.name + " ( ";
  for (const input of variant.inputs) {
    variantName += input.name + "=" + input.value + " ";
  }
  variantName += ")";
  return variantName;
}

async function createVariant(context) {
  console.log("Provide values for the new Variant");

  const defaultVariantName = context.product.name + " (" + context.size + ")";
  let variantName = await promptInput(`>>> variant name (default: ${defaultVariantName})`);
  if (!variantName || variantName === "") {
    variantName = defaultVariantName;
  }

  console.log("Provide values for the parameters");

  let inputs = [];
  for (const parameter of context.release.parameters) {
    const paramName = parameter.name;
    let inputValue = await promptInput(`>>> ${paramName} (default: ${parameter.defaultValue})`);
    if (!inputValue || inputValue === "") {
      inputValue = parameter.defaultValue;
    }
    inputs.push({ name: paramName, value: inputValue });
  }

  return await postVariant(variantName, inputs, context.release, context.config, context.token);
}

async function handleVariantUpdate(updateType, context) {
  switch (updateType) {
    case "CREATE":
      return await createVariant(context);
    default:
      console.log("unsupported option: " + updateType);
      break;
  }

  process.exit(1);
}

export { getVariants, variantNameWithParams, handleVariantUpdate };