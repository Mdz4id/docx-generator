import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import sdk, { InputFile, ID } from "node-appwrite";

export default async function (req, res) {
  const client = new sdk.Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new sdk.Databases(client);
  const storage = new sdk.Storage(client);

  try {
    const { docId } = JSON.parse(req.payload);

    // Fetch document containing answers JSON
    const dbId = process.env.DB_ID;
    const collectionId = process.env.COLLECTION_ID;
    const document = await databases.getDocument(dbId, collectionId, docId);

    const answers = document.answers; // your JSON

    // Download template file
    const templateBuffer = await storage.getFileDownload(
      process.env.STORAGE_BUCKET_ID,
      "template.docx"
    );

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // Replace placeholders with answers
    doc.render(answers);

    // Create final Word file buffer
    const buf = doc.getZip().generate({ type: "nodebuffer" });

    // Upload the generated file to Appwrite storage
    const uploaded = await storage.createFile(
      process.env.STORAGE_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buf, "filled_questionnaire.docx")
    );

    return res.json({
      success: true,
      fileId: uploaded.$id,
      downloadUrl: `${process.env.APPWRITE_ENDPOINT}/storage/buckets/${process.env.STORAGE_BUCKET_ID}/files/${uploaded.$id}/download?project=${process.env.APPWRITE_PROJECT_ID}`
    });

  } catch (error) {
    console.error("Error generating document:", error);
    return res.json({ success: false, error: error.message });
  }
}
