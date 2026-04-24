const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerName = "incidents";

const uploadToBlob = async (file) => {
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const blobName = `incident-${Date.now()}-${file.originalname}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadFile(file.path, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
    });

    return blockBlobClient.url;
};

module.exports = { uploadToBlob };
