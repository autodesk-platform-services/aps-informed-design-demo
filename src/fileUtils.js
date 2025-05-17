import fs from 'fs';
import { File } from 'fetch-blob/from.js';

const toBlob = async (filePath, fileName) => {
    const buffer = fs.readFileSync(filePath); 
    return new File([buffer], fileName);
}

const getFileNameFromPath = (filePath) => `${filePath}`.replace(/^.*(\\|\/|\:)/, '');

/**
 * Gets the chunk information for upload taking into account OSS/S3 limitations.
 */
const getChunksInfo = (blob) => {
    const MAX_PARTS = 25;
    const MIN_CHUNKSIZE = 0x500000;

    // Just use the blob size if we can upload in a single call.
    // Otherwise, make the chunk size as large as needed but not smaller than the allowed minimum.
    const chunkSize = blob.size <= MIN_CHUNKSIZE ? blob.size : Math.max(MIN_CHUNKSIZE, Math.ceil(blob.size / MAX_PARTS));
    const numChunks = Math.ceil(blob.size / chunkSize);

    return {
        chunkSize,
        numChunks,
    };
};

const isFilePath = (path) => {
    if(!path) {
      return false; // path is undefined or null
    }
    
    try {
      return fs.statSync(path).isFile();
    } catch (err) {
      return false; // path doesn't exist or is inaccessible
    }
  }

export { toBlob, getFileNameFromPath, getChunksInfo, isFilePath };