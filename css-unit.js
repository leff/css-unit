/**
  css-unit

  Given a small chunck of HTML, render it as an image, then do it again later and
  see what's changed.

  @author Jason Brackins
*/


/*
  specBaseDir is where all the specs live in your project

  We need this info so that we can match our output paths to the input paths,
  regardless of glob. We want the caller to be able to specify the file
  in mulitple ways (glob, full path, etc) and always have the output go to the
  same place.

  @TODO: make this an option.
*/
var specBaseDir = '/specs/';


var q = require('q'),
    fs = require('fs'),
    http = require('http'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    path = require('path'),
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


  if( !fs.existsSync(refImg) ) {
    deferred.reject(new Error('ERROR: Reference file does not exist => ' + refImg));
  } else {
    var diff = resemble(refImg).compareTo(newImg).onComplete(function(data) {
      if( Number(data.misMatchPercentage) >= 0.01 ) {
        data.getDiffImage().pack().pipe(fs.createWriteStream(diffImgPath));
        deferred.reject(new Error('Unacceptable Difference (' + data.misMatchPercentage + ')\n   Reference: ' + refImg + '\n   New: ' + newImg + '\n   Diff: ' + diffImgPath ));
      } else {
        deferred.resolve();
      }
    });
  }
  return deferred.promise;
}


function relativePath(file, relativeBaseDir) {
  return path.relative(path.join(file.cwd, relativeBaseDir), file.path);
}

function relativeDir(relative_path) {
  return relative_path.substr(0, relative_path.lastIndexOf('/'));
}

/**
  Create a reference for a given file.

  The file is a gulp/node file object.
  If it has an options property, we will look in it for viewport height and width settings.
*/
CSSUnit.prototype.reference = function refernce(file) {
  var relative_path = relativePath(file, specBaseDir),
      relative_dir = relativeDir(relative_path);

  mkdirp.sync( path.join(process.cwd(), '/temp/reference/', relative_dir) );

  var htmlFilePath = path.join('/temp/reference/', relative_path),
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      renderedPngPath = path.join(process.cwd(), '/test/reference/', relative_path + '.png');

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
  var relative_path = relativePath(file, specBaseDir),
      relative_dir = relativeDir(relative_path);

  mkdirp.sync( path.join(process.cwd(), '/temp/compare/', relative_dir) );
  mkdirp.sync( path.join(process.cwd(), '/test/compare/', relative_dir) );
  mkdirp.sync( path.join(process.cwd(), '/test/diff/', relative_dir) );

  var htmlFilePath = path.join('/temp/compare/', relative_path),
      htmlFileUrl = 'http://localhost:'+port+htmlFilePath,
      refImgPath = path.join(process.cwd(), '/test/reference/', relative_path + '.png'),
      newImgPath = path.join(process.cwd(), '/test/compare/', relative_path + '.png');

  renderTestHTMLFile(file, process.cwd() + htmlFilePath);

  return capturePNGFile(htmlFileUrl, newImgPath, file.options)
  .then(function() {
    console.log('comparing => ' + relative_path);
    return compare(refImgPath, newImgPath, process.cwd() + '/test/diff/' + file.relative + '.png');
  });
}


module.exports = CSSUnit;