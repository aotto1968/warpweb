const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const README_MD = path.join(__dirname, '..', 'README_warpweb.md');
const README_HTML = path.join(__dirname, 'README_warpweb.html');

function convertReadme() {
    const mdPath = README_MD;
    const htmlPath = README_HTML;

    const mdStat = fs.statSync(mdPath);
    let needsConversion = true;

    try {
        const htmlStat = fs.statSync(htmlPath);
        if (htmlStat.mtime >= mdStat.mtime) {
            needsConversion = false;
        }
    } catch (e) {
    }

    if (!needsConversion) {
        console.log('README_warpweb.html is up to date');
        return;
    }

    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const htmlContent = marked(mdContent);

    const fullHtml = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WarpWeb Help</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            background: #f5f5f5;
            color: #333;
        }
        h1 { color: #0066cc; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
        h2 { color: #444; margin-top: 30px; }
        h3 { color: #555; }
        code { background: #e8e8e8; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; }
        pre code { background: none; padding: 0; color: inherit; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        th { background: #e8e8e8; }
        tr:nth-child(even) { background: #f9f9f9; }
        ul, ol { padding-left: 25px; }
        li { margin: 5px 0; }
        blockquote { border-left: 4px solid #0066cc; margin: 15px 0; padding: 10px 15px; background: #e8f4ff; }
        a { color: #0066cc; }
        hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
        .close-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #0066cc;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
        }
        .close-btn:hover { background: #0055aa; }
    </style>
</head>
<body>
    <button class="close-btn" onclick="window.close()">Close</button>
    ${htmlContent}
</body>
</html>`;

    fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
    console.log('Created README_warpweb.html');
}

convertReadme();
