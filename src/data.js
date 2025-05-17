import { getFileNameFromPath, toBlob, getChunksInfo } from './fileUtils.js';
import { apiPost } from './apiUtils.js';

/**
 * Uploads a file to the cloud.
 * @returns The object key with which the file can be downloaded.
 */
async function uploadFile(
    context,
    filePath
) {
    try {
        console.log(`Attempting to create a file object for ${filePath}`);
        const fileName = getFileNameFromPath(filePath);
        const file = await toBlob(filePath, fileName);
        const fileSize = file.size;
        console.log(`Attempting to get chunks for ${fileName} with size ${fileSize}`);
        const { chunkSize, numChunks } = getChunksInfo(file);
        console.log(`.. Chunk size: ${chunkSize}, Number of chunks: ${numChunks}`);

        console.log(`Attempting to get upload urls for ${fileName}`);
        const uploadUrlsResponse = await getUploadUrls(context, fileName, numChunks);
        console.log(`.. Got ${uploadUrlsResponse.urls.length} upload urls`);


        // upload the chunks
        for (let i = 0, start = 0; i < numChunks; ++i) {
            console.log(`.. Uploading chunk ${i + 1} of ${numChunks}`);
            const end = Math.min(start + chunkSize, file.size);
            const data = file.slice(start, end);

            await fetch(uploadUrlsResponse.urls[i], {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                body: data,
            });
            start = end;
        }

        console.log(`Attempting to complete upload for ${fileName}`);
        const completeUploadResponse = await completeUpload(
            context, uploadUrlsResponse.objectKey, uploadUrlsResponse.uploadKey,
            fileName, fileSize);

        return completeUploadResponse.objectKey;
    } catch (error) {
        console.error(`Error uploading file: ${error.message}`);
        throw error;
    }
};


const getUploadUrls = async (context, fileName, numChunks) => {
    const productId = context.product.id;
    const accessType = context.config.accessType;
    const accessId = context.config.accessId;
    const token = context.token;

    const getUploadURLsEndpoint = context.config.baseUrl + `/products/${productId}/upload-urls?accessType=${accessType}&accessId=${accessId}`;
    const uploadURLsPayload = {
        fileName,
        parts: numChunks
    };

    const res = await apiPost(getUploadURLsEndpoint, token, uploadURLsPayload);
    const data = await res.json();

    if (!res.ok) {
        const text = await res.text();
        console.error("Error fetching upload urls: ", res.status, res.statusText);
        console.error(text);
        throw new Error(`Error fetching upload urls: ${res.status} ${res.statusText}`);
    }

    return data;
}

const completeUpload = async (context, objectKey, uploadKey, fileName, fileSize) => {
    const productId = context.product.id;
    const accessType = context.config.accessType;
    const accessId = context.config.accessId;
    const token = context.token;

    const res = await apiPost(
        `${context.config.baseUrl}/products/${productId}/complete-upload?accessType=${accessType}&accessId=${accessId}`,
        token,
        {
            objectKey,
            uploadKey,
            fileName,
            fileSize,
            contentType: "application/octet-stream"
        }
    );

    const data = await res.json();

    if (!res.ok) {
        console.log("Error completing upload: " + res.status + " " + res.statusText);
        console.log(data);
        throw new Error("Error completing upload: " + res.status + " " + res.statusText);
    }

    return data;
}

export { uploadFile };