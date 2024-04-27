const fs = require('fs');
const path = require('path');
const babel = require("@babel/core");
const postcss = require("postcss");
const htmlparser2 = require("htmlparser2");
const marked = require("marked");
const axios = require('axios');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
dotenv.config();

// Babel configuration for parsing JavaScript/TypeScript
const babelConfig = {
    presets: ["@babel/preset-env", "@babel/preset-react", "@babel/preset-typescript"],
    plugins: [
        "@babel/plugin-syntax-dynamic-import",
        "@babel/plugin-proposal-class-properties",
        "@babel/plugin-proposal-private-methods",
        "@babel/plugin-proposal-nullish-coalescing-operator",
        "@babel/plugin-proposal-optional-chaining"
    ]
};

// Credentials from environment variables
const OA_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_PAT = process.env.GITHUB_PAT;

// Set up axios for GitHub API authentication
axios.defaults.headers.common['Authorization'] = `Bearer ${GITHUB_PAT}`;

// Rate limiting setup
const RATE_LIMIT_WINDOW_MS = 1000;
let lastApiCallTime = 0;

// OpenAI setup
const openai = new OpenAI({ apiKey: OA_API_KEY });

async function summarizeFileOpenAI(filename, fileContent) {
    const currentTime = Date.now();
    if (currentTime - lastApiCallTime < RATE_LIMIT_WINDOW_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WINDOW_MS - (currentTime - lastApiCallTime)));
    }
    lastApiCallTime = Date.now();
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "You are a helpful repo assistant. Be concise but insightful." }, 
                       { role: "user", content: `Summarize the code for this file (${filename}) and its purpose. What functions and UI elements are written here? : ${fileContent}. Assume explanation for the common web developer.` }],
            model: "gpt-4",
            max_tokens: 175,
        });
        const summary = completion.choices[0].message.content;
        console.log(summary);
        return summary;
    } catch (error) {
        console.error(`Error summarizing file ${filename} using OpenAI: ${error}`);
        return `Error summarizing file: ${error.message}`;
    }
}

async function generateAST(file, content) {
    let ast;
    try {
        const fileType = getFileType(file);
        switch (fileType) {
            case "JavaScript/TypeScript":
                ast = await babel.parseAsync(content, {...babelConfig, filename: file});
                break;
            case "JSON":
                ast = parseJSON(content);
                break;
            case "HTML":
                ast = htmlparser2.parseDocument(content);
                break;
            case "CSS":
                ast = postcss.parse(content);
                break;
            case "Markdown":
                const htmlFromMarkdown = marked(content);
                ast = htmlparser2.parseDocument(htmlFromMarkdown);
                break;
            default:
                console.log(`Skipping unsupported file type: ${file}`);
                return null; // Skip unsupported files
        }
    } catch (error) {
        console.error(`Error processing ${file}: ${error}`);
        return null;
    }
    return ast;
}

function getFileType(file) {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
        case '.js':
        case '.jsx':
        case '.ts':
        case '.tsx':
            return "JavaScript/TypeScript";
        case '.json':
            return "JSON";
        case '.html':
            return "HTML";
        case '.css':
            return "CSS";
        case '.md':
            return "Markdown";
        // Add common video file extensions here
        case '.mp4':
        case '.avi':
        case '.mov':
        case '.wmv':
        case '.gif':
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.tiff':
        case '.svg':
        case '.bmp':
        case '.webp':
        case '.ico':
        case '.webm':
        case '.mov':
        case '.ttf':
        case '.otf':
        case '.woff':
        case '.woff2':
            return "Media";
        default:
            return "Unknown";
    }
}

function parseJSON(file, code) {
    try {
        const parsed = JSON.parse(code);
        const ast = deriveSchema(parsed);
        return { type: "object", properties: ast };
    } catch (error) {
        console.error(`Error parsing JSON in file ${file}: ${error}`);
        throw error; // Rethrow to be caught by the calling function
    }
}

function deriveSchema(jsonObject) {
    const getType = (value) => {
        if (Array.isArray(value)) {
            return 'array';
        } else if (value === null) {
            return 'null';
        } else {
            return typeof value;
        }
    };

    const schema = {};
    for (const key in jsonObject) {
        const value = jsonObject[key];
        schema[key] = { type: getType(value) };
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            schema[key].properties = deriveSchema(value);
        }
    }
    return schema;
}


async function fetchRepoMetadata(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    try {
        const response = await axios.get(url);
        return {
            name: response.data.name,
            description: response.data.description,
            demoLink: response.data.homepage || "No demo link provided"
        };
    } catch (error) {
        console.error('Error fetching repository metadata:', error);
        return null;
    }
}

async function fetchFiles(owner, repo, path = '') {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    try {
        const response = await axios.get(url);
        let files = [];
        for (const item of response.data) {
            if (item.type === 'file') {
                files.push({
                    path: item.path,
                    download_url: item.download_url
                });
            } else if (item.type === 'dir') {
                const moreFiles = await fetchFiles(owner, repo, item.path);
                files = files.concat(moreFiles);
            }
        }
        return files;
    } catch (error) {
        console.error('Error fetching repository files:', error);
        return [];
    }
}

function stringifySafe(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return '[Circular]'; // Duplicate reference found, replace key
            }
            seen.add(value);
        }
        return value;
    });
}

async function generateASTsForRepo(owner, repo) {
    const metadata = await fetchRepoMetadata(owner, repo);
    const files = await fetchFiles(owner, repo);
    const asts = [];

    for (const file of files) {
        const response = await axios.get(file.download_url);
        const fileContent = response.data;
        const fileType = getFileType(file.path);
        if (fileType !== "Media") {  // Check if it's not a video before processing
            const ast = await generateAST(file.path, fileContent);
            const summary = await summarizeFileOpenAI(file.path, fileContent);
            asts.push({
                file: file.path,
                type: fileType,
                ast: ast,
                summary: summary,
                sourceCode: JSON.stringify(fileContent) // Optionally, include or exclude source code
            });
        }
    }

    const repoAST = {
        metadata: metadata,
        files: asts
    };

    fs.writeFileSync(`${repo}-asts.json`, stringifySafe(repoAST), 'utf8');
    console.log(`ASTs for ${repo} have been saved.`);
}

// Edit list of repos here:
const repositories = [
    { owner: 'cameronking4', name: 'langmarket' },
    // Add more repositories as needed
];

// Execute the script for each repository
repositories.forEach(repo => {
    generateASTsForRepo(repo.owner, repo.name).catch(err => {
        console.error(`Error processing repository ${repo.name}:`, err);
    });
});
