var fs = require('fs'),
    _ = require('lodash'),
    driver = require('node-phantom-simple');

var testTempalte = _.template('<html><head><% _.forEach(cssDependencies, function(dep) { %><link rel="stylesheet" href="<%= dep %>"><% }); %></head><body><%= testContents %></body></html>');


function renderTest(file, outputPath) {
  var context = {
      cssDependencies: [],
      testContents: file.contents
    },
    rendered = testTempalte(context);

  fs.writeFileSync(outputPath, rendered)
  return rendered;
}


function runTest(url, outputPath) {
  console.log('runtest', url, outputPath);
  driver.create({ path: require('slimerjs').path }, function(err, browser) {
    return browser.createPage(function(err, page) {
      return page.open(url, function(err, status) {
        console.log("opened site? ", status);
        page.render(outputPath);
        browser.exit();
      });

    });
  });
}




module.exports.reference = function refernce(file) {

  var htmlFilePath = '/temp/' + file.relative+'.html',
      compliedTest = renderTest(file, process.cwd() + htmlFilePath);
  console.log('css-unit reference', compliedTest);

  runTest('http://localhost:9356'+htmlFilePath, process.cwd() + '/reference/' + file.relative + '.png');


}


module.exports.test = function test(file) {
  var compliedTest = renderTest(file);
  var compliedTest = renderTest(file);
  runTest('http://localhost:8000/'+file.relative, process.cwd() + '/test');

  // compare();

  console.log('css-unit test', compliedTest);
}
