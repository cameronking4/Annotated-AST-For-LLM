const fs = require('fs');
const path = require('path');
const babel = require("@babel/core");
const postcss = require("postcss");
const htmlparser2 = require("htmlparser2");
const marked = require("marked");
const axios = require('axios');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

app.set("port", PORT);
app.use(cors());
app.use(bodyParser.json());


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

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://unpkg.com/@tailwindcss/ui/dist/tailwind-ui.min.css" rel="stylesheet">
    <title>Sketch2App</title>
</head>
<body>
    <div id="root"></div> <!-- React will attach to this div -->
    
    <!-- React and ReactDOM scripts, replace "latest" with specific versions as needed -->
    <script src="https://unpkg.com/react@latest/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@latest/umd/react-dom.production.min.js"></script>

    <!-- Your compiled JavaScript bundle -->
    <script src="app.js"></script> <!-- Ensure the src matches your JavaScript output file -->
</body>
</html>`;

const css = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

async function createCodesandbox(code) {
    const response = await fetch("https://codesandbox.io/api/v1/sandboxes/define?json=1", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            externalResources: ['https://unpkg.com/@tailwindcss/ui/dist/tailwind-ui.min.css'],
            files: {
                "/index.css": {
                    content: css,
                },
                "package.json": {
                    content: {
                        dependencies: {
                            react: 'latest',
                            'react-dom': 'latest',
                            'react-dropzone': 'latest',
                            'react-router-dom': 'latest',
                            'react-scripts': 'latest',
                            tailwindcss: 'latest',
                            postcss: 'latest',
                            autoprefixer: 'latest',
                            'recharts': 'latest',
                            'lucide-react': 'latest',
                            'react-confetti': 'latest',
                            'react-swipe-card': 'latest',
                            axios: 'latest', // For making HTTP requests
                            redux: 'latest', // For state management
                            'react-redux': 'latest', // React bindings for Redux
                            'redux-thunk': 'latest', // Middleware for Redux asynchronous actions
                            'styled-components': 'latest', // For CSS in JS
                            'react-icons': 'latest', // A set of free MIT-licensed high-quality SVG icons
                            lodash: 'latest', // A modern JavaScript utility library delivering modularity, performance, & extras
                            moment: 'latest', // Parse, validate, manipulate, and display dates and times in JavaScript
                            'react-query': 'latest', // Hooks for fetching, caching and updating asynchronous data in React
                            'react-toastify': 'latest', // For adding notifications to your app
                            'react-helmet': 'latest' // A document head manager for React
                        },
                    },
                },
                "/README.md": {
                    content: `# [Sketch-2-App](https://www.sketch2app.io/)
              ## Use GPT4v to generate web app code (CRA + Tailwind)
              Use React to generate a web app with Tailwind CSS. It will generate code and a sandbox to preview the app within seconds of capturing your wireframe/sketch
              
              [![Sketch2Code](https://markdown-videos-api.jorgenkh.no/url?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D1VC_a0JP7TM)](https://www.youtube.com/watch?v=1VC_a0JP7TM)
              
              Run the application in the command line and it will be available at \`http://localhost:3000\`. 
              \`\`\`bash
              npm install && npm start
              \`\`\``
                },
                "App.js": {
                    content: code,
                },
                "/index.js": {
                    content: `import React from 'react';
                    import ReactDOM from 'react-dom/client';
                    import './index.css';
                    import App from './App';
              
                    const root = ReactDOM.createRoot(document.getElementById('root'));
                    root.render(
                      <React.StrictMode>
                        <App />
                      </React.StrictMode>
                    );`
                },
                "index.html": {
                    content: html,
                },
                "/tailwind.config.js": {
                    content: `module.exports = {
                      content: ["./src/**/*.{js,jsx,ts,tsx}"],
                      theme: {
                        extend: {},
                      },
                      plugins: [],
                    };
                `}
            },
        }),
    });
    const data = await response.json();
    return generateIframeData(data.sandbox_id);
}

// Generate iframe data from a sandbox ID
function generateIframeData(sandbox_id) {
    const url = `https://codesandbox.io/embed/${sandbox_id}?fontsize=11&view=preview&hidenavigation=1&theme=dark`;
    const preview = `https://${sandbox_id}.csb.app/`;
    console.log(sandbox_id, preview);
    return [url, preview];
}


app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500);
    res.json({
      error: {
        message: err.message,
      },
    });
  });

app.get("/", (req, res) => {
  res.send("Working smarter not harder!");
});

app.post('/ast', async (req, res) => {
    try {
        const owner = req.body.owner;
        const repo = req.body.repo;
        const AST = await generateASTsForRepo(owner, repo);
        res.json(AST);
    }
    catch (error) {
        console.error('Error generating ASTs:', error);
        res.status(500).send('Error generating ASTs');
    }
    res.send('Hello World!');
});

// Endpoint to create and return iframe data
app.post('/create-sandbox', async (req, res) => {
    const { code } = req.body;
    try {
        const iframeData = await createCodesandbox(code);
        res.json(iframeData);
    } catch (error) {
        res.status(500).send('Failed to create CodeSandbox');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});