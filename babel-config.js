const babelConfig = {
    presets: [
        "@babel/preset-env",       // Transpile ES6+ down to ES5
        "@babel/preset-typescript",// Handle TypeScript
        "@babel/preset-react"      // Handle JSX
    ],
    plugins: [
        "@babel/plugin-syntax-dynamic-import",             // Allow parsing of dynamic imports
        "@babel/plugin-proposal-class-properties",         // Handle class properties
        "@babel/plugin-proposal-private-methods",          // Handle private methods in classes
        "@babel/plugin-proposal-nullish-coalescing-operator", // Handle ?? operator
        "@babel/plugin-proposal-optional-chaining"         // Handle ?. operator
    ]
};
