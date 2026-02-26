/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const FONTS_SOURCE_DIR = path.join(ROOT_DIR, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts');

// The path pattern that the browser is complaining about (from your screenshot)
// assets/.../@expo/.../Fonts/Ionicons.hash.ttf
const TARGET_REL_PATH = 'assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts';
const TARGET_DIR = path.join(DIST_DIR, TARGET_REL_PATH);

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function fixIcons() {
    if (!fs.existsSync(FONTS_SOURCE_DIR)) {
        console.error(`Source fonts not found at: ${FONTS_SOURCE_DIR}`);
        return;
    }

    if (!fs.existsSync(DIST_DIR)) {
        console.error(`Dist directory not found. Please run 'npx expo export' first.`);
        return;
    }

    // Create the deep directory structure in dist
    if (!fs.existsSync(TARGET_DIR)) {
        console.log(`Creating target directory: ${TARGET_DIR}`);
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }

    // Process each font file
    const fonts = fs.readdirSync(FONTS_SOURCE_DIR);
    let copyCount = 0;

    fonts.forEach(font => {
        if (!font.endsWith('.ttf') && !font.endsWith('.otf')) return;

        const sourcePath = path.join(FONTS_SOURCE_DIR, font);
        const hash = getFileHash(sourcePath);

        // The filename format expected is usually Name.hash.ext
        // Example: Ionicons.b4eb097d35f44ed943676fd56f6bdc51.ttf
        const ext = path.extname(font);
        const name = path.basename(font, ext);
        const targetName = `${name}.${hash}${ext}`;
        const targetPath = path.join(TARGET_DIR, targetName);

        fs.copyFileSync(sourcePath, targetPath);

        console.log(`Copied ${font} -> ${targetName}`);
        copyCount++;
    });

    console.log(`✅ Successfully fixed ${copyCount} icon font files.`);
}

fixIcons();
