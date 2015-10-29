var q = require('q'),
    fs = require('fs'),
    http = require('http'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    finalhandler = require('finalhandler'),
    serveStatic = require('serve-static'),
    driver = require('node-phantom-simple'),
    slimer = require('slimerjs'),
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


function renderTestHTMLFile(file, outputPath) {
  var context = {
      cssDependencies: (options.cssDependencies) ? options.cssDependencies : '',
      testContents: file.contents
    },
    rendered = testTempalte(context);
  fs.writeFileSync(outputPath, rendered);
  return rendered;
}


function capturePNGFile(url, outputPath, renderOptions) {
  var deferred = q.defer();
  var viewportSize = { width:1100, height:768 };
  if( renderOptions.width ) { viewportSize.width = renderOptions.width; }
  if( renderOptions.height ) { viewportSize.height = renderOptions.height; }

  startServer();
  deferred.promise.then(stopServer);

  driver.create({ path: slimer.path }, function(err, browser) {
    return browser.createPage(function(err, page) {
      return page.open(url, function(err, status) {
        page.set('viewportSize', viewportSize, function() {
          page.render(outputPath, function(err) {
            browser.exit();
            deferred.resolve();
          });
        });
      });
    });
  });
  return deferred.promise;
}

function compare(refImg, newImg, diffImgPath) {
  var deferred = q.defer();

  var diff = resemble(refImg).compareTo(newImg).onComplete(function(data) {
    if( Number(data.misMatchPercentage) >= 0.01 ) {
      data.getDiffImage().pack().pipe(fs.createWriteStream(diffImgPath));
      deferred.reject(new Error('Unacceptable Difference (' + data.misMatchPercentage + ')\n   Reference: ' + refImg + '\n   New: ' + newImg + '\n   Diff: ' + diffImgPath ));
    } else {
      deferred.resolve();
    }
  });
  return deferred.promise;
}

/**
  Create a reference for a given file.

  The file is a gulp/node file object.
  If it has an options property, we will look in it for viewport height and width settings.
*/
CSSUnit.prototype.reference = function refernce(file) {
  mkdirp.sync( process.cwd() + '/temp/reference/' + file.relative.substr(0, file.relative.lastIndexOf('/')) );

  var htmlFilePath = '/temp/reference/' + file.relative,
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      renderedPngPath = process.cwd() + '/test/reference/' + file.relative + '.png';

  renderTestHTMLFile(file, process.cwd() + htmlFilePath);

  console.log('creating ref: ' + renderedPngPath);
  return capturePNGFile(htmlFileUrl, renderedPngPath, file.options);
}

/**
  Test the previously created reference for a given file against a newly generated comparison file.

  The file is a gulp/node file object.
  If it has an options property, we will look in it for viewport height and width settings.
*/
CSSUnit.prototype.test = function test(file) {
  var relative_path = file.relative.substr(0, file.relative.lastIndexOf('/'));

  mkdirp.sync( process.cwd() + '/temp/compare/' + relative_path );
  mkdirp.sync( process.cwd() + '/test/compare/' + relative_path );
  mkdirp.sync( process.cwd() + '/test/diff/' + relative_path );

  var htmlFilePath = '/temp/compare/' + file.relative,
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      refImgPath = process.cwd() + '/test/reference/' + file.relative + '.png',
      newImgPath = process.cwd() + '/test/compare/'   + file.relative + '.png';

  renderTestHTMLFile(file, process.cwd() + htmlFilePath);

  return capturePNGFile(htmlFileUrl, newImgPath, file.options)
  .then(function() {
    console.log('comparing => ' + file.relative);
    return compare(refImgPath, newImgPath, process.cwd() + '/test/diff/' + file.relative + '.png');
  });
}


module.exports = CSSUnit;