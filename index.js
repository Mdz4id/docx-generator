// Using require for CommonJS module compatibility
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const sdk = require("node-appwrite");

// Destructuring specific properties from the sdk object
const { InputFile, ID } = sdk;

/*
  This is the main function that will be executed by Appwrite.
  It's an async function to allow for the use of await.
*/
module.exports = async function (req, res) {
  // Initialize the Appwrite client with credentials from environment variables
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  // Initialize Appwrite services
  const databases = new sdk.Databases(client);
  const storage = new sdk.Storage(client);

  try {
    console.log("Function execution started.");

    // BETTER PAYLOAD HANDLING:
    // Check if a payload is provided. If not, manual execution is assumed.
    // This prevents the JSON.parse error on an empty string.
    if (!req.payload) {
        throw new Error("Execution failed: Please provide a payload with a 'docId' when executing manually. e.g., { \"docId\": \"YOUR_ID\" }");
    }

    const { docId } = JSON.parse(req.payload);
    
    if (!docId) {
        throw new Error("Payload is missing the required 'docId' field.");
    }

    console.log(`Processing document with ID: ${docId}`);

    // Fetch the specific document from the database
    const dbId = process.env.DB_ID;
    const collectionId = process.env.COLLECTION_ID;
    console.log(`Fetching document from database '${dbId}', collection '${collectionId}'.`);
    const document = await databases.getDocument(dbId, collectionId, docId);

    // Extract the answers JSON from the fetched document
    const answers = document.answers;
    console.log("Successfully fetched answers JSON.");

    // Download the .docx template file from Appwrite Storage
    console.log(`Downloading template 'template.docx' from bucket '${process.env.STORAGE_BUCKET_ID}'.`);
    const templateBuffer = await storage.getFileDownload(
      process.env.STORAGE_BUCKET_ID,
      "template.docx"
    );
    console.log("Template downloaded successfully.");

    // Load the template buffer into PizZip and Docxtemplater
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // Render the document by replacing placeholders with the answers JSON
    doc.render(answers);
    console.log("Document rendered with answers.");

    // Generate the final Word file as a Node.js buffer
    const buf = doc.getZip().generate({ type: "nodebuffer" });

    const outputFilename = `filled_questionnaire_${docId}.docx`;

    // Upload the newly generated file back to Appwrite Storage
    console.log(`Uploading generated file '${outputFilename}' to storage.`);
    const uploaded = await storage.createFile(
      process.env.STORAGE_BUCKET_ID,
      ID.unique(), // Generate a unique ID for the file
      InputFile.fromBuffer(buf, outputFilename) // Create an InputFile from the buffer
    );
    console.log(`File uploaded successfully with ID: ${uploaded.$id}`);

    // Return a success response with the new file's ID and a download URL
    return res.json({
      success: true,
      fileId: uploaded.$id,
      downloadUrl: `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.STORAGE_BUCKET_ID}/files/${uploaded.$id}/download?project=${process.env.APPWRITE_PROJECT_ID}`
    });

  } catch (error) {
    // Log any errors to the console for debugging
    console.error("Error generating document:", error.message);
    // Return a failure response with the error message
    return res.json({ success: false, error: error.message, stack: error.stack });
  }
};
