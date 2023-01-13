/*jshint node:true*/
"use strict";

var _ = require('lodash');
var changeTypes = require('./change-types');
var DiffLevel = changeTypes.DiffLevel;
var Diff = require('diff');
var canonicalizeAttribute = require('../util/cheerio-utils').canonicalizeAttribute;

module.exports = createHeuristic;

var HEURISTIC_WEIGHTS = {
  name:         {same: +10, differs: -10},
  id:           {same: +45, differs: -15},
  attributes:   {same: +12, differs: -12},
  contents:     {same: +11, differs: -11},
  textContents: {same: +5, differs: -5},
};
var DEFAULT_OPTIONS = {
  name: 1.0, id: 1.0, attributes: 1.0, contents: 1.0, textContents: 1.0, textContents_threshold: 0.50 // weight multipliers
};

function createHeuristic(weights) {
  weights = _.defaults(weights || {}, DEFAULT_OPTIONS);
  _.each(weights, function(weight, key) {
    if (weight === false) weights[key] = 0;
    if (weight === true) weights[key] = 1;
  });

  return heuristic;

  function heuristic($n1, $n2, childChanges) {
    // this flag will be set to true if we've discovered any changes
    // local to the node
    var different = false;
    var similarity = 0;

    // check the tag names
    var tagsDiffer = ($n1[0].name != $n2[0].name);
    different = different || (tagsDiffer && (weights.name > 0));
    similarity += componentResult('name', tagsDiffer);

    // we'll work with attributes now
    var attributesOnNode1 = _.keys($n1[0].attribs);
    var attributesOnNode2 = _.keys($n2[0].attribs);
    var attributes = _.uniq(attributesOnNode1.concat(attributesOnNode2));

    // ID has it's own separate handling due to its importance in IDentifying nodes
    // basically, we treat it as a "super-attribute" in terms of checking if nodes are the same
    if (attributes.indexOf('id') >= 0) {
      attributes.splice(attributes.indexOf('id'), 1); // don't compare it with other attributes
      var idsDiffer = attributeValuesDiffer($n1[0].attribs['id'], $n2[0].attribs['id']);
      different = different || (idsDiffer && (weights.id > 0));
      similarity += componentResult('id', idsDiffer);
    }

    // other attributes are treated as an aggregate
    // if at least 50% are the same, we treat them as matching
    if (attributes.length) {
      var differentAttribs = _.filter(attributes, function (attr) {
        return attributeValuesDiffer($n1[0].attribs[attr], $n2[0].attribs[attr]);
      });
      var differentAttribRatio = differentAttribs.length / attributes.length;
      var attributesDifferSignificantly = differentAttribRatio > 0.5;
      different = different || ((differentAttribs.length > 0) && (weights.attributes > 0));
      similarity += componentResult('attributes', attributesDifferSignificantly);
    }

    // if the contents are at least 50% different
    // we treat this as a significant difference
    var possibleChildChanges = _.max([$n1.contents().length, $n2.contents().length]);
    if (possibleChildChanges > 0) {
      var totalChildChanges;
      var found = {added: 0, removed: 0, changed: 0};
      _.each(childChanges, function (change) {
        if (change.before.$parent.is($n1) || change.after.$parent.is($n2)) {
          found[change.type]++;
        }
      });

      // adds/removals 'cancel' each other to handle single changes generating an add/remove
      totalChildChanges = _.max([found.added, found.removed]) + found.changed;

      var contentsDifferSignificantly = (totalChildChanges / possibleChildChanges) > 0.99;
      different = different || (childChanges.length > 0);
      similarity += componentResult('contents', contentsDifferSignificantly);
    }

    // finally, we'll check the text contents
    if ($n1[0].type !== 'root' && $n2[0].type !== 'root') {
      var text$n1 = $n1.text().trim().replace(/\s+/g, ' ');
      var text$n2 = $n2.text().trim().replace(/\s+/g, ' ');
      if (text$n1 !== text$n2) {
        var possibleTextChanges = _.max([text$n1.length, text$n2.length]);
        var diffs = Diff.diffChars(text$n1, text$n2);
        var totalTextChanges = _.reduce(diffs, function (sum, diff) {
          return sum + ((diff.added || diff.removed) ? diff.value.length : 0);
        }, 0);
        var textContentsDifferSignificantly = (totalTextChanges / possibleTextChanges) > weights.textContents_threshold;
        different = different || (totalTextChanges > 0);
        similarity += componentResult('textContents', textContentsDifferSignificantly);
      }
    }

    // no changes?
    if (!different) {
      return DiffLevel.IDENTICAL;
    } else {
      // some changes, the accumulated 'result' decides whether it's still the same node
      return (similarity >= 0) ? DiffLevel.SAME_BUT_DIFFERENT : DiffLevel.NOT_THE_SAME_NODE;
    }
  }

  function attributeValuesDiffer(value1, value2) {
    value1 = canonicalizeAttribute(value1);
    value2 = canonicalizeAttribute(value2);
    return value1 != value2;
  }

  function componentResult(component, isDifferent) {
    return HEURISTIC_WEIGHTS[component][isDifferent ? 'differs' : 'same'] * weights[component];
  }
}
