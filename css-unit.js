var q = require('q'),
    fs = require('fs'),
    http = require('http'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    finalhandler = require('finalhandler'),
    serveStatic = require('serve-static'),
    driver = require('node-phantom-simple'),
    resemble = require('node-resemble-js');

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
};


function startServer() {
  // Serve up public/ftp folder
  var serve = serveStatic(process.cwd());

  // Create server
  server = http.createServer(function(req, res) {
    var done = finalhandler(req, res);
    serve(req, res, done);
  })
  // console.log('serving ', process.cwd(), 'on port ', port);
  server.listen(port);
}

function stopServer() {
  server.close();
}


function renderTest(file, outputPath) {
  var context = {
      cssDependencies: (options.cssDependencies) ? options.cssDependencies : '',
      testContents: file.contents
    },
    rendered = testTempalte(context);
  fs.writeFileSync(outputPath, rendered)
  return rendered;
}


function runTest(url, outputPath) {
  startServer();
  // console.log('runtest', url, outputPath);
  var deferred = q.defer();
  deferred.promise.then(stopServer);

  driver.create({ path: require('slimerjs').path }, function(err, browser) {
    return browser.createPage(function(err, page) {
      return page.open(url, function(err, status) {
        page.render(outputPath);
        browser.exit();
        deferred.resolve();
      });
    });
  });
  return deferred.promise;
}

function compare(refImg, newImg, diffImgPath) {
  var deferred = q.defer();

  var diff = resemble(refImg).compareTo(newImg).onComplete(function(data) {
    if( Number(data.misMatchPercentage) >= 0.01 ) {
      data.getDiffImage().pack().pipe(fs.createWriteStream(process.cwd() + diffImgPath));
      deferred.reject(new Error('Unacceptable Difference (' + data.misMatchPercentage + ')\n   Reference: ' + refImg + '\n   New: ' + newImg + '\n   Diff: ' + process.cwd() + diffImgPath ));
    } else {
      deferred.resolve();
    }
  });
  return deferred.promise;
}


CSSUnit.prototype.reference = function refernce(file) {
  var destPath = process.cwd() + '/temp/reference/' + file.relative.substr(0, file.relative.lastIndexOf('/'));
  mkdirp.sync(destPath);

  var htmlFilePath = '/temp/reference/' + file.relative,
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      renderedPngPath = process.cwd() + '/test/reference/' + file.relative + '.png';

  renderTest(file, process.cwd() + htmlFilePath);

  console.log('creating ref: ' + renderedPngPath);
  return runTest(htmlFileUrl, renderedPngPath);
}


CSSUnit.prototype.test = function test(file) {
  var dirPath = process.cwd() + '/temp/compare/' + file.relative.substr(0, file.relative.lastIndexOf('/'));
  mkdirp.sync(dirPath);
  dirPath = process.cwd() + '/test/diff/' + file.relative.substr(0, file.relative.lastIndexOf('/'));
  mkdirp.sync(dirPath);

  var htmlFilePath = '/temp/compare/' + file.relative,
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      refImgPath = process.cwd() + '/test/reference/' + file.relative + '.png',
      newImgPath = process.cwd() + '/test/compare/'   + file.relative + '.png';

  renderTest(file, process.cwd() + htmlFilePath);

  return runTest(htmlFileUrl, newImgPath)
  .then(function() {
    console.log('comparing => ' + file.relative);
    return compare(refImgPath, newImgPath, '/test/diff/' + file.relative + '.png');
  });

}


module.exports = CSSUnit;