const Metaflac = require('metaflac-js');
const fs = require('fs');
const path = require('path');

// Find a FLAC file to test
const fileStr = fs.readdirSync('../data').find(f => f.endsWith('.flac')) ||
    'test.flac';

if (!fs.existsSync(fileStr)) {
    console.log("No FLAC file found. Please provide path!");
    process.exit(1);
}

try {
    console.log("Reading:", fileStr);
    const flac = new Metaflac(fileStr);

    // Read tags
    console.log("Current tags:", flac.getAllTags());

    // Write new tag
    flac.setTag("TEST_TAG", "Hello World");
    flac.save();
    console.log("Saved.");

    // Read again
    const flac2 = new Metaflac(fileStr);
    console.log("New tags:", flac2.getAllTags());

    // Cleanup
    flac2.removeTag("TEST_TAG");
    flac2.save();
} catch (e) {
    console.error(e);
}
