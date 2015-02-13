var _ = require('underscore');
var assert = require('chai').assert;
var hiff = require('../src/hiff');

function assertOneAddition(diff) {
  assert(diff);
  assert.equal(diff.changes.length, 1);
  assert.equal(diff.changes[0].type, 'added');
}

function assertOneRemoval(diff) {
  assert(diff);
  assert.equal(diff.changes.length, 1);
  assert.equal(diff.changes[0].type, 'removed');
}

describe("Adding tags", function () {
  it("should be reported when adding new tags in the middle", function () {
    var html1 = "<div> <b>1</b> <strong>2</strong> </div>";
    var html2 = "<div> <b>1</b> <i>new</i> <strong>2</strong> </div>";
    var d = hiff.diff(html1, html2);
    assertOneAddition(d);
  });

  it("should be reported when adding new tags at the end", function () {
    var html1 = "<div> <b>1</b> <strong>2</strong> </div>";
    var html2 = "<div> <b>1</b> <strong>2</strong> <i>new</i></div>";
    var d = hiff.diff(html1, html2);
    assertOneAddition(d);
  });

  it("should be reported when adding new tags at the start", function () {
    var html1 = "<div> <b>1</b> <strong>2</strong> </div>";
    var html2 = "<div> <i>new</i> <b>1</b> <strong>2</strong> </div>";
    var d = hiff.diff(html1, html2);
    assertOneAddition(d);
  });

});

describe("Removing tags", function () {
  it("should be reported when removing tags in the middle", function () {
    var html1 = "<div> <b>1</b> <i>removed</i> <strong>2</strong> </div>";
    var html2 = "<div> <b>1</b> <strong>2</strong> </div>";
    var d = hiff.diff(html1, html2);
    assertOneRemoval(d);
  });

  it("should be reported when removing tags at the end", function () {
    var html1 = "<div> <b>1</b> <strong>2</strong> <i>removed</i></div>";
    var html2 = "<div> <b>1</b> <strong>2</strong> </div>";
    var d = hiff.diff(html1, html2);
    assertOneRemoval(d);
  });

  it("should be reported when removing tags at the start", function () {
    var html1 = "<div> <i>removed</i> <b>1</b> <strong>2</strong> </div>";
    var html2 = "<div> <b>1</b> <strong>2</strong> </div>";
    var d = hiff.diff(html1, html2);
    assertOneRemoval(d);
  });

});

describe("Multiple additions/removals", function() {
  it("should be correctly recognized", function() {
    var html1 = "<div> <b>1</b> <br> <br> <i>2</i> <p>3</p> </div>";
    var html2 = "<div> <a>added</a> <b>1</b> <i>2</i> <strong>Hello</strong> <em>Hi!</em> <p>3</p> <em>Done.</em></div>";
    var diff = hiff.diff(html1, html2);
    var changeTypes = _.pluck(diff.changes, 'type');
    assert.deepEqual(changeTypes, ['added', 'removed', 'removed', 'added', 'added', 'added']);
    var tags = _.chain(diff.changes).pluck('node').pluck(0).pluck('name').value();
    assert.deepEqual(tags, ['a', 'br', 'br', 'strong', 'em', 'em']);
  });
});
