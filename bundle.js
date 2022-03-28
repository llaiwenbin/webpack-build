const fs = require("fs");
const open = require('open');
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");

const resolve = (...paths) => {
    return path.join("./", ...paths);
};
  
const config = {
    entry: './src/index.js',
    ouput: {
        path: './dist',
        filename :'bundle.js'
    },
    autoOpen: false
    // ....
}

process.argv.forEach(arg => {
    const configPath = arg.split('--config=')[1];
    if (configPath) {
        Object.assign(
            config,
            require(path.join(__dirname, configPath))
        );
    }
})

const getModuleInfo = (file) => {
  const body = fs.readFileSync(resolve(file), "utf-8");
  const ast = parser.parse(body, {
    sourceType: "module",
  });
  const deps = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(file);
      const absPath = resolve(dirname, node.source.value);
      deps[node.source.value] = absPath;
    },
  });
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  return { file, deps, code };
};
const parseModules = (filePath) => {
  const entry = getModuleInfo(filePath);
  const modulesInfo = [entry];
  for (let i = 0; i < modulesInfo.length; i++) {
    const { deps = [] } = modulesInfo[i];
    for (let key in deps) {
      if (deps.hasOwnProperty(key)) {
        modulesInfo.push(getModuleInfo(deps[key]));
      }
    }
  }

    const depsGraph = modulesInfo.reduce((graph, { file, deps, code }) => {
        graph[file] = { code, deps };
        return graph
    }, {});
    
  return depsGraph
};
const bundle = (file) => { 
    const depsGraph = JSON.stringify(parseModules(file));
    return `(function(graph){
        function require(file){
            function absRequire(relPath){
                return require(graph[file].deps[relPath])
            }
            exports = {};
            (function (require,exports,code){
                eval(code)
            })(absRequire,exports,graph[file].code)
            return exports
        }
        require('${file}')
    })(${depsGraph})`
}

const content = bundle(config.entry)
//写入到我们的dist目录下
const buildFilePath = config.ouput.path;
const buildPath = buildFilePath +'/' +config.ouput.filename;

fs.access(buildFilePath, fs.constants.F_OK, (err) => {
    err && fs.mkdirSync(buildFilePath);
    fs.writeFileSync(buildPath ,content)
});

let htmlContent = fs.readFileSync('./public/index.html','utf-8').replace('<% RPLACE_URL %>', buildPath);
fs.writeFileSync('./index.html', htmlContent);
config.autoOpen && open('./index.html');