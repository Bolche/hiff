var compare = require('../').compare;
var cheerio = require('cheerio');
var cssPath = require('../lib/util/css-path');
var assert = require('chai').assert;
var fs = require('fs/promises');
var path = require('path');
var _ = require('lodash');

describe("nodePath()", function() {
  it("should prefer to identify elements by ID", function() {
    var html = "<div id='hello'></div>";
    assert.equal(nodePathFor(html, '#hello'), 'div#hello');
  });

  it("should use classes if possible", function() {
    var html = "<div class='button disabled'></div>";
    assert.equal(nodePathFor(html, 'div'), 'div.button.disabled');
  });

  it("should use just the tag name if there is nothing else and it's unambiguous", function() {
    var html = "<div>Well.</div>";
    assert.equal(nodePathFor(html, 'div'), 'div');
  });

  it("should produce nested paths properly", function() {
    var html = '<a id="hi"><b class="hello"><div>Hi!</div></b>';
    assert.equal(nodePathFor(html, 'div'), 'a#hi > b.hello > div');
  });

  it("should use nth-of-type() to disambiguate between identical nodes", function() {
    var html = "<a>One.</a><a>Two.</a><a>Three.</a>";
    var $ = cheerio.load(html, {quirksMode: true}, false);
    var $secondA = $($('a')[1]);
    assert.equal(cssPath($secondA), "a:nth-of-type(2)");
  });

  it("should use nth-of-type() to disambiguate even if classes are present", function() {
    var html = '<a class="red">One.</a><a class="red">Two.</a><a class="red">Three.</a>';
    var $ = cheerio.load(html, {quirksMode: true}, false);
    var $secondA = $($('a')[1]);
    assert.equal(cssPath($secondA), "a.red:nth-of-type(2)");
  });

  it("should return 'undefined' for nodes which don't have valid CSS paths", function() {
    var html = "<div><!-- No path -->Nowhere.<![CDATA[no how]]></div>";
    var $ = cheerio.load(html, {quirksMode: true}, false);
    var contents = _.map($('div').contents(), function(node) { return $(node); });

    _.each(contents, function($node) {
      assert.strictEqual(cssPath($node), undefined);
    });
  });

  it("should return ':root' for the artificial root element", function() {
    var html = "<div></div>";
    var $ = cheerio.load(html, {quirksMode: true}, false);
    assert.equal(cssPath($.root()), ":root");
  });

  it("should produce paths that can be fed back to $()", function(done) {
    fs.readFile(path.join(__dirname, "fixtures/path-roundtrip-test.html")).then(function(html) {
      var $ = cheerio.load(html, {quirksMode: true}, false);

      // check if CSS paths roundtrip correctly for all nodes
      $('*').each(function() {
        var $node = $(this), path = cssPath($node);
        if ($.html($node) != $.html($(path))) {
          throw new AssertionError("Path '" + path + "' is incorrect for node:\n" + $.html($node));
        }
      });
    }).then(done).catch(done);
  });
});

function nodePathFor(html, selector) {
  var $ = cheerio.load(html, {quirksMode: true}, false);
  return cssPath($(selector));
}
