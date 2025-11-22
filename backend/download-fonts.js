const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, 'fonts');

// Create fonts directory if it doesn't exist
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

// URLs for Noto Sans fonts
const fonts = [
    {
        name: 'NotoSans-Regular.ttf',
        url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf'
    },
    {
        name: 'NotoSans-Bold.ttf',
        url: 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf'
    }
];

function downloadFont(font) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(fontsDir, font.name);

        // Skip if file already exists
        if (fs.existsSync(filePath)) {
            console.log(`✓ ${font.name} already exists`);
            resolve();
            return;
        }

        console.log(`Downloading ${font.name}...`);
        const file = fs.createWriteStream(filePath);

        https.get(font.url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (redirectResponse) => {
                    redirectResponse.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ ${font.name} downloaded successfully`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlinkSync(filePath);
                    reject(err);
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✓ ${font.name} downloaded successfully`);
                    resolve();
                });
            }
        }).on('error', (err) => {
            fs.unlinkSync(filePath);
            reject(err);
        });
    });
}

async function downloadAllFonts() {
    try {
        console.log('Downloading Vietnamese fonts for PDF generation...\n');
        await Promise.all(fonts.map(font => downloadFont(font)));
        console.log('\n✓ All fonts downloaded successfully!');
        console.log('PDF generation will now support Vietnamese characters.\n');
    } catch (error) {
        console.error('Error downloading fonts:', error.message);
        console.log('\nYou can manually download fonts from:');
        console.log('https://fonts.google.com/noto/specimen/Noto+Sans');
        process.exit(1);
    }
}

downloadAllFonts();


