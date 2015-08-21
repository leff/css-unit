var fs = require('fs'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    finalhandler = require('finalhandler'),
    http = require('http'),
    serveStatic = require('serve-static'),
    driver = require('node-phantom-simple');

var port = 9356,
    testTempalte, server, options;


function CSSUnit(opts) {
  options = opts;
  if( opts.templateFile ) {
    var tplFile = fs.readFileSync(process.cwd() + '/' + opts.templateFile);
    testTempalte = _.template(tplFile);
  } else {
    testTempalte = _.template('<html><head><% _.forEach(cssDependencies, function(dep) { %><link rel="stylesheet" href="<%= dep %>"><% }); %></head><body><%= testContents %></body></html>');
  }
  startServer();
};


function startServer() {
  // Serve up public/ftp folder
  var serve = serveStatic(process.cwd());

  // Create server
  server = http.createServer(function(req, res) {
    var done = finalhandler(req, res);
    serve(req, res, done);
  })
  console.log('serving ', process.cwd(), 'on port ', port);
  server.listen(port);
}

function stopServer() {
  server.close();
}


function renderTest(file, outputPath) {
  console.log('render');
  var context = {
      cssDependencies: (options.cssDependencies) ? options.cssDependencies : '',
      testContents: file.contents
    },
    rendered = testTempalte(context);

  fs.writeFileSync(outputPath, rendered)
  return rendered;
}


function runTest(url, outputPath) {
  // startServer();
  // console.log('runtest', url, outputPath);
  driver.create({ path: require('slimerjs').path }, function(err, browser) {
    return browser.createPage(function(err, page) {
      return page.open(url, function(err, status) {
        console.log("opened site? ", status);
        page.render(outputPath);
        browser.exit();
      });
    });
  });
  // stopServer();
}

CSSUnit.prototype.reference = function refernce(file) {
  // create dir
  var destPath = process.cwd() + '/test/temp/' + file.relative.substr(0, file.relative.lastIndexOf('/'));
  mkdirp.sync(destPath);

  var htmlFilePath = '/test/temp/' + file.relative+'.html',
      compliedTest = renderTest(file, process.cwd() + htmlFilePath);
  console.log('css-unit reference');

  runTest('http://localhost:'+port+htmlFilePath, process.cwd() + '/test/reference/' + file.relative + '.png');
}


CSSUnit.prototype.test = function test(file) {
  var compliedTest = renderTest(file);
  var compliedTest = renderTest(file);
  runTest('http://localhost:'+port+htmlFilePath, process.cwd() + '/test/fresh/' + file.relative + '.png');

  // compare();

}


module.exports = CSSUnit;