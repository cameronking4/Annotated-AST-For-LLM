const fs = require('fs');
const path = require('path');
const babel = require("@babel/core");
const postcss = require("postcss");
const htmlparser2 = require("htmlparser2");
const marked = require("marked");
const {OpenAI} = require('openai');
const dotenv = require('dotenv');
dotenv.config();

const babelConfig = {
    presets: [
        "@babel/preset-env",
        "@babel/preset-react",
        "@babel/preset-typescript"
    ],
    plugins: [
        "@babel/plugin-syntax-dynamic-import",
        "@babel/plugin-proposal-class-properties",
        "@babel/plugin-proposal-private-methods",
        "@babel/plugin-proposal-nullish-coalescing-operator",
        "@babel/plugin-proposal-optional-chaining"
    ]
};

const OA_API_KEY = process.env.OPENAI_API_KEY;
const RATE_LIMIT_WINDOW_MS = 1000; // Adjust this based on actual rate limits
let lastApiCallTime = 0;
console.log(`OpenAI API key: ${OA_API_KEY}`);

async function summarizeFileOpenAI(filename, file) {
    const openai = new OpenAI({apiKey: OA_API_KEY});
    const currentTime = Date.now();
    if (currentTime - lastApiCallTime < RATE_LIMIT_WINDOW_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WINDOW_MS - (currentTime - lastApiCallTime)));
    }
    lastApiCallTime = Date.now();
    try{ 
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: "You are a helpful repo assistant. Be concise but insightful." }, { role: "user", content: `Summarize the code for this file (${filename}) and its purpose. What functions and UI elements are written here? : ${file}. Respond in less than 250 words.` }],
      model: "gpt-4",
    });
    const summary = completion.choices[0].message.content;
    console.log(summary);
    return summary;
    } catch (error) {
    console.error(`Error summarizing file ${filename} using OpenAI: ${error}`);
    return `Error summarizing file: ${error.message}`;
    }
}

async function callDummyAPI(filename, sourceCode) {
    console.log('Summarizing file: ', filename)
    const summary = await summarizeFileOpenAI(filename, sourceCode);
    return Promise.resolve(`Summary for ${filename} : ${summary}`);
}

async function generateAST(directory) {
    const files = getFiles(directory);
    const asts = [];

    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        let ast, summary;
        try {
            if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
                ast = await babel.parseAsync(code, {
                    ...babelConfig,
                    filename: file
                });
            } else if (file.endsWith('.json')) {
                ast = parseJSON(file, code);
            } else if (file.endsWith('.html')) {
                ast = htmlparser2.parseDocument(code);
            } else if (file.endsWith('.css')) {
                ast = postcss.parse(code);
            } else if (file.endsWith('.md')) {
                const html = marked(code);
                ast = htmlparser2.parseDocument(html);
            } else {
                console.log(`Skipping unsupported file type: ${file}`);
                continue;  // Skip unsupported files
            }
        } catch (error) {
            console.error(`Error processing ${file}: ${error}`);
            asts.push({
                file: file,
                type: getFileType(file),
                error: error.message,
                sourceCode: code
            });
            continue;  // Continue processing the next file on error
        }

        try {
            // Ensure that the summary is awaited before pushing to asts
            summary = await callDummyAPI(file, code);
        } catch (error) {
            console.error(`Error generating summary for ${file}: ${error}`);
            summary = `Error generating summary: ${error.message}`;
        }

        // Push the result to the asts array, ensuring that summary is properly handled
        asts.push({
            file: file,
            type: getFileType(file),
            ast: ast,
            summary: summary, // Directly use the resolved summary
            sourceCode: code
        });
    }

    return asts;
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

function getFiles(dir, files_ = []) {
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = path.join(dir, files[i]);
        if (fs.statSync(name).isDirectory()) {
            if (files[i] !== 'node_modules') {
                getFiles(name, files_);  // Recurse into subdirectories, excluding node_modules
            }
        } else {
            // Check if the file is package-lock.json and skip it
            if (!name.endsWith('package-lock.json')) {
                files_.push(name);
            }
        }
    }
    return files_;
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
        default:
            return "Unknown";
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

// Example usage
const YOUR_DIRECTORY = './test';
generateAST(YOUR_DIRECTORY)
    .then(asts => {
        fs.writeFileSync('asts.json', stringifySafe(asts), 'utf8');
        console.log("ASTs and DOMs have been written to asts.json");
    })
    .catch(err => console.error(err));
