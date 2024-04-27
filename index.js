const fs = require('fs');
const path = require('path');
const babel = require("@babel/core");
const postcss = require("postcss");
const htmlparser2 = require("htmlparser2");
const marked = require("marked");

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
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            schema[key] = { type: 'object', properties: deriveSchema(value) };
        } else {
            schema[key] = { type: getType(value) };
        }
    }

    return schema;
}

function parseJSON(file, code) {
    try {
        const parsed = JSON.parse(code); // Parses the JSON into an "AST" object
        return { file, type: "JSON", ast: deriveSchema(parsed), valid: true };
    } catch (error) {
        console.error(`Error parsing JSON in file ${file}: ${error}`);
        return { file, type: "JSON", error: error.message, valid: false };
    }
}

async function generateAST(directory) {
    let files = getFiles(directory);
    const asts = [];

    for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        try {
            if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
                const ast = await babel.parseAsync(code, {
                    ...babelConfig,
                    filename: file
                });
                asts.push({ file, type: "JavaScript/Typescript", ast });
            } else if (file.endsWith('.json')) {
                const ast = parseJSON(file, code);
                asts.push({ file, type: "JSON", ast});
            } else if (file.endsWith('.html')) {
                const dom = htmlparser2.parseDocument(code);
                asts.push({ file, type: "HTML", dom });
            } else if (file.endsWith('.css')) {
                const cssAst = postcss.parse(code);
                asts.push({ file, type: "CSS", cssAst });
            } else if (file.endsWith('.md')) {
                const html = marked(code); // Convert Markdown to HTML
                const dom = htmlparser2.parseDocument(html); // Parse HTML to DOM
                asts.push({ file, type: "Markdown", dom });
            } else {
                console.log(`Skipping unsupported file type: ${file}`);
                asts.push({ file, type: "Other", skipped: true, reason: "Unsupported file type" });
            }
        } catch (error) {
            console.error(`Error processing ${file}: ${error}`);
            asts.push({ file, type: "Error", error: error.message });
        }
    }

    return asts;
}

function getFiles(dir, files_ = []) {
    const files = fs.readdirSync(dir);
    for (const i in files) {
        const name = path.join(dir, files[i]);
        if (fs.statSync(name).isDirectory()) {
            if (files[i] !== 'node_modules') {
                getFiles(name, files_);
            }
        } else {
            files_.push(name);
        }
    }
    return files_;
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
