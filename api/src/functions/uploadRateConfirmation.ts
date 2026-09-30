import { randomUUID } from "node:crypto";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ClientSecretCredential } from "@azure/identity";
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

// Front door for the rate-confirmation intake pipeline, replacing the old
// email-attachment trigger. This function only uploads the file and hands
// n8n a short-lived link to it — OCR, extraction, and the Loads write all
// stay in n8n, untouched.
//
// Azure Static Web Apps' co-located Functions don't expose a managed-identity
// endpoint to the runtime (see pool.ts / README Known Issues), so this reuses
// the same service-principal credentials as the SQL connection rather than
// DefaultAzureCredential — still AAD-based, never a storage account key.

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function uploadRateConfirmation(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!accountName || !clientId || !clientSecret || !tenantId || !webhookUrl || !webhookSecret) {
    context.error(
      "uploadRateConfirmation: missing one of AZURE_STORAGE_ACCOUNT_NAME, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET",
    );
    return { status: 500, jsonBody: { error: "Upload pipeline is not configured yet." } };
  }

  let file: File;
  try {
    const formData = await request.formData();
    const entry = formData.get("file");
    if (!(entry instanceof File)) {
      return { status: 400, jsonBody: { error: "No file was included in the upload." } };
    }
    file = entry;
  } catch (err) {
    context.error("uploadRateConfirmation: failed to parse form data", err);
    return { status: 400, jsonBody: { error: "Could not read the uploaded file." } };
  }

  const extension = extensionOf(file.name);
  const allowedExtensions = ACCEPTED_TYPES[file.type];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    return {
      status: 400,
      jsonBody: { error: "Unsupported file type. Upload a PDF, JPG, PNG, or WEBP file." },
    };
  }

  if (file.size === 0) {
    return { status: 400, jsonBody: { error: "The uploaded file is empty." } };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { status: 400, jsonBody: { error: "File is too large. The limit is 10 MB." } };
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential,
  );
  const containerClient = blobServiceClient.getContainerClient("rate-confirmations");
  const blobName = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${sanitizeFilename(file.name)}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: { blobContentType: file.type },
    });
  } catch (err) {
    context.error("uploadRateConfirmation: blob upload failed", err);
    return { status: 502, jsonBody: { error: "Failed to store the file. Please try again." } };
  }

  let sasUrl: string;
  try {
    const startsOn = new Date(Date.now() - 60 * 1000);
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const userDelegationKey = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: "rate-confirmations",
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        startsOn,
        expiresOn,
      },
      userDelegationKey,
      accountName,
    ).toString();
    sasUrl = `${blockBlobClient.url}?${sasToken}`;
  } catch (err) {
    context.error("uploadRateConfirmation: SAS generation failed", err);
    return {
      status: 502,
      jsonBody: { error: "File was stored, but could not be handed off for processing." },
    };
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": webhookSecret },
      body: JSON.stringify({ fileUrl: sasUrl, filename: file.name }),
    });
    if (!webhookResponse.ok) {
      context.error(`uploadRateConfirmation: n8n webhook returned ${webhookResponse.status}`);
      return {
        status: 502,
        jsonBody: { error: "File was stored, but processing could not be started." },
      };
    }
  } catch (err) {
    context.error("uploadRateConfirmation: n8n webhook call failed", err);
    return {
      status: 502,
      jsonBody: { error: "File was stored, but processing could not be started." },
    };
  }

  return { jsonBody: { ok: true } };
}

app.http("uploadRateConfirmation", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "upload-rate-confirmation",
  handler: uploadRateConfirmation,
});
