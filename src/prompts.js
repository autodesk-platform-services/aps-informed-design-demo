import ora from 'ora'; // command line spinner
import { rawlist, input, checkbox, confirm, editor } from '@inquirer/prompts';

async function promptChoice(type, options, callback = null, context = null, addUpdateOptions = true) {
  let counter = 0;
  const choices = options.map(item => { return { name: item.name, value: counter++ } });

  if (callback && addUpdateOptions) {
    choices.push({ name: "> Create " + type, value: "CREATE" });
    // choices.push({ name: "> Delete " + type + "(s)", value: "DELETE" });
  }

  choices.push({ name: "> Exit", value: "EXIT" })

  const choice = await rawlist({
    message: `Select ${type}`,
    choices: choices
  });

  if (choice === "EXIT") {
    process.exit(0);
  }

  if (callback && ((choice === "CREATE" || choice === "DELETE") || !addUpdateOptions)) {
    context.size = options.length;
    return await callback(choice, context);
  }
  return choice;
}

async function promptInput(inputName) {
  return await input({ message: `${inputName}: ` });
}

async function promptAcc(type, data) {
  let choice = await promptChoice(type, data.map(item => { return { name: item.attributes.name } }));
  return data[choice].id;
}

function itemFromChoice(choice, items) {
  return (isNaN(choice)) ? choice : items[choice];
}

async function promptDelete(type, items) {
  const answer = await checkbox({
    message: "Delete " + type,
    choices: items
  });
  return answer;
}

async function promptConfirm(message) {
  return await confirm({ message: message });
}

async function promptMultilineInput(message) {
  return await editor({
    message: message,
  });
}

async function promptJsonInput(message) {
  const raw = await promptMultilineInput(message);

  // Clean and parse the raw JSON input
  const parsedJson = cleanAndParseRawJson(raw);
  if (parsedJson) {
    return parsedJson;
  } else {
    console.error("Invalid JSON input.");

    // retry
    return await promptJsonInput(message);
  }
}

function cleanAndParseRawJson(raw) {
  // Step 1: Unescape common escape characters
  let cleaned = raw
    .replace(/\\n/g, '')           // Remove escaped newlines
    .replace(/\\t/g, '')           // Remove escaped tabs
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();

  // Step 2: Remove trailing commas inside objects and arrays
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return null;
  }
}

async function doProgress(text, callback) {
  const spinner = ora(text).start();
  try {
    return await callback();
  } finally {
    spinner.stop();
  }
}

export { promptChoice, promptInput, promptAcc, itemFromChoice, promptDelete, promptConfirm, promptJsonInput, doProgress };

