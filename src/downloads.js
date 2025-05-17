import { apiGet } from './apiUtils.js';

async function getDownloadUrl(config, output, token) {
    const accessId = config.accessId;
    const outputsEndpoint = config.baseUrl + "/downloads?accessType=" + config.accessType + "&accessId=" + accessId + "&outputIds=" + output.id;
    const res = await apiGet(outputsEndpoint, token);
    
    if (!res.ok) {
        const text = await res.text();
        console.error("Error retrieving download url: ", res.status, res.statusText);
        console.error(text);
        throw new Error(`Error retrieving download url: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data.results[0].url;
}

export { getDownloadUrl };