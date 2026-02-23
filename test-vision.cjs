const vision = require("@google-cloud/vision");

async function test() {
  try {
    const imagePath = process.argv[2] || "./sample.png";
    const client = new vision.ImageAnnotatorClient();

    const [result] = await client.documentTextDetection(imagePath);

    const full = result.fullTextAnnotation?.text?.trim();
    console.log("\n--- Debug ---");
    console.log("hasFullTextAnnotation:", Boolean(result.fullTextAnnotation));
    console.log("textAnnotationsCount:", result.textAnnotations?.length || 0);

    if (full) {
      console.log("\nDetected text:\n");
      console.log(full);
      return;
    }

    // Fallback: sometimes textAnnotations[0] contains everything
    const fallback = result.textAnnotations?.[0]?.description?.trim();
    if (fallback) {
      console.log("\nDetected text (fallback):\n");
      console.log(fallback);
      return;
    }

    console.log("\nNo text detected (or image not readable).");
  } catch (err) {
    console.error("\nERROR:\n", err);
    process.exit(1);
  }
}

test();