const {
    BlobServiceClient,
    BlobSASPermissions,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters
} = require("@azure/storage-blob");

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

const parseConnectionString = (value) => Object.fromEntries(
    value.split(";").filter(Boolean).map((part) => {
        const separatorIndex = part.indexOf("=");
        return [part.slice(0, separatorIndex), part.slice(separatorIndex + 1)];
    })
);

const storageSettings = parseConnectionString(connectionString);
const sharedKeyCredential = new StorageSharedKeyCredential(
    storageSettings.AccountName,
    storageSettings.AccountKey
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

const signVideoUrl = (videoUrl) => {
    if (!videoUrl || videoUrl === "processing") return videoUrl;

    const parsedUrl = new URL(videoUrl);
    const expectedHost = `${storageSettings.AccountName}.blob.core.windows.net`;
    if (parsedUrl.hostname !== expectedHost) return videoUrl;

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const [containerName, ...blobNameParts] = pathParts;
    const blobName = blobNameParts.join("/");
    if (containerName !== "incidents" || !blobName) return videoUrl;

    const now = new Date();
    const sas = generateBlobSASQueryParameters({
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn: new Date(now.getTime() - 5 * 60 * 1000),
        expiresOn: new Date(now.getTime() + 60 * 60 * 1000)
    }, sharedKeyCredential).toString();

    return `${parsedUrl.origin}${parsedUrl.pathname}?${sas}`;
};

const signIncidentVideoUrls = (incidents) => incidents.map((incident) => {
    const data = typeof incident.toJSON === "function" ? incident.toJSON() : { ...incident };
    data.video_url = signVideoUrl(data.video_url);
    return data;
});

module.exports = { uploadToBlob, signIncidentVideoUrls, signVideoUrl };
